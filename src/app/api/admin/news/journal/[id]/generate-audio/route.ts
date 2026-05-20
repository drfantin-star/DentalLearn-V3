import { NextResponse } from 'next/server'

import { isSuperAdmin } from '@/lib/auth/rbac'
import { createJob } from '@/lib/audio-generation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// POST /api/admin/news/journal/[id]/generate-audio
//
// Phase 1 (synchrone, ici) : valide l'épisode, vérifie l'idempotence, crée
//   un job en BDD (news_episode_id), fire la Supabase Edge Function
//   audio-generation-journal-worker en fire-and-forget, retourne 202 + jobId.
// Phase 2 (background, Edge Function) : génère l'audio ElevenLabs (chunking
//   4500 chars, retry 3x, pause 2s), upload Storage news-audio/journal/, met
//   à jour news_episodes (audio_url, duration_s, status='ready' si pas
//   regenerate), marque le job completed/failed.
// Phase 3 (client-driven) : l'UI polle /api/admin/audio-jobs/[jobId]/status
//   puis chaîne POST /api/admin/news/journal/[id]/generate-timeline après
//   succès audio (mapping déterministe rapide, <5 s).
//
// Avant T5-dette-news : route synchrone qui faisait audio + timeline en un
//   seul appel (maxDuration=300). Un journal de 12 min dépassait les 300 s
//   ElevenLabs et timeout Vercel même sur plan Pro.
// Après T5-dette-news : la route ne fait que créer le job et fire-and-forget
//   l'Edge Function. Plus de dépendance maxDuration > 30 s pour cette route.
//
// Mode régénération via querystring `?regenerate=true` :
//   - Skip précondition status (accepte n'importe quel status)
//   - Le worker ne touche pas status / published_at / validated_by
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const isRegenerate =
      new URL(request.url).searchParams.get('regenerate') === 'true'

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { id: episodeId } = params
    if (!episodeId) {
      return NextResponse.json({ error: 'id manquant' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: 'Configuration Supabase manquante (URL ou service role key)' },
        { status: 503 },
      )
    }
    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: 'Clé API ElevenLabs manquante' },
        { status: 503 },
      )
    }

    const admin = createAdminClient()

    const { data: episode, error: fetchErr } = await admin
      .from('news_episodes')
      .select('id, type, status, script_md')
      .eq('id', episodeId)
      .eq('type', 'journal')
      .maybeSingle()

    if (fetchErr) {
      console.error('generate-audio journal fetch error:', fetchErr)
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }
    if (!episode) {
      return NextResponse.json({ error: 'Journal introuvable' }, { status: 404 })
    }
    if (!isRegenerate && episode.status !== 'draft') {
      return NextResponse.json(
        { error: 'Génération audio autorisée uniquement sur un journal en draft' },
        { status: 409 },
      )
    }
    const scriptMd = episode.script_md as string | null
    if (!scriptMd || scriptMd.trim().length === 0) {
      return NextResponse.json(
        { error: "Script vide — générer le script avant l'audio" },
        { status: 400 },
      )
    }

    // Idempotence : pas de double génération si un job pending/running
    // existe déjà pour cet épisode.
    const { data: existingJobs, error: existingErr } = await admin
      .from('audio_generation_jobs')
      .select('id, status')
      .eq('news_episode_id', episodeId)
      .in('status', ['pending', 'running'])
      .limit(1)

    if (existingErr) {
      return NextResponse.json(
        { error: existingErr.message },
        { status: 500 },
      )
    }
    if (existingJobs && existingJobs.length > 0) {
      return NextResponse.json(
        { error: 'job_already_running', jobId: existingJobs[0].id },
        { status: 409 },
      )
    }

    const jobId = await createJob({
      newsEpisodeId: episodeId,
      scriptText: scriptMd,
      triggeredBy: session.user.id,
      withTimestamps: false,
    })

    // Fire-and-forget vers la Supabase Edge Function. Si l'appel échoue
    // avant d'atteindre la fonction, le job reste en 'pending' et sera
    // marqué 'failed' par le sweep stale (cron 5 min, seuil 10 min).
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/audio-generation-journal-worker`
    fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        job_id: jobId,
        episode_id: episodeId,
        script_text: scriptMd,
        regenerate: isRegenerate,
      }),
      signal: AbortSignal.timeout(5_000),
    }).catch((err) => {
      console.error(
        '[generate-audio journal] edge function call failed:',
        err,
      )
    })

    return NextResponse.json({ jobId }, { status: 202 })
  } catch (err) {
    console.error('POST generate-audio journal error:', err)
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Erreur serveur',
      },
      { status: 500 },
    )
  }
}
