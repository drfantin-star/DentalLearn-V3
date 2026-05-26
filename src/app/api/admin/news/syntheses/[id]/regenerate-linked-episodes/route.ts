import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================================
// POST /api/admin/news/syntheses/[id]/regenerate-linked-episodes — POC-T12-D-2
//
// Orchestre la régénération séquentielle stricte (pas Promise.all) de
// plusieurs episodes liés à une synthèse via appels HTTP internes vers les
// 2 endpoints existants generate-audio :
//   - news_episodes.type ∈ ('digest','insight') → /api/admin/news/episodes/[id]/generate-audio?regenerate=true
//   - news_episodes.type = 'journal'             → /api/admin/news/journal/[id]/generate-audio?regenerate=true
//
// Le flag ?regenerate=true (livré T12-D-1) garantit :
//   - status courant préservé (published reste published, archived reste archived)
//   - published_at préservé (date originale conservée)
//   - validated_by préservé (validateur initial conservé)
//   - pipeline ElevenLabs + Storage archive `_archive/...` + timeline IDENTIQUES
//
// Échec sur un episode = on continue le batch (pas d'abort), résultat
// remonté dans `results[].status = 'error'`. Le client peut retenter
// individuellement.
//
// Auth : isSuperAdmin() (invariant). Cookies forwardés vers les endpoints
// internes pour préserver le contexte session (sinon 403 downstream).
//
// Limite max 20 episodes par batch (garde-fou Vercel timeout, ~50s/episode).
// ============================================================================

// 5 min de buffer pour absorber jusqu'à ~5-6 régénérations séquentielles
// (chaque ElevenLabs call ~30-50s + Storage upload + timeline). Au-delà,
// l'admin doit splitter en plusieurs batches.
export const maxDuration = 300

const Body = z.object({
  episode_ids: z.array(z.string().uuid()).min(1).max(20),
})

interface RegenResult {
  episode_id: string
  status: 'success' | 'error'
  error_message?: string
}

export async function POST(
  request: Request,
  { params: _params }: { params: Promise<{ id: string }> },
) {
  try {
    // synthesisId disponible via params si besoin de contextualiser dans
    // les logs ; non utilisé pour la logique (les episode_ids du body
    // suffisent et l'auth admin garantit le périmètre).
    await _params

    // ----- 1. Auth -----
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    // ----- 2. Parse + validation body -----
    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
    }

    const parsed = Body.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'episode_ids invalide' },
        { status: 400 },
      )
    }
    const episodeIds = parsed.data.episode_ids

    // ----- 3. Fetch types pour les episodes demandés (1 query batchée) -----
    const adminSupabase = createAdminClient()
    const { data: episodes, error: epErr } = await adminSupabase
      .from('news_episodes')
      .select('id, type')
      .in('id', episodeIds)

    if (epErr) {
      console.error('Erreur lecture news_episodes:', epErr)
      return NextResponse.json({ error: epErr.message }, { status: 500 })
    }

    const typeByEpisode = new Map<string, string>()
    for (const e of episodes ?? []) {
      typeByEpisode.set(e.id as string, e.type as string)
    }

    // ----- 4. Boucle séquentielle stricte -----
    const origin = new URL(request.url).origin
    const cookieHeader = request.headers.get('cookie') ?? ''

    const results: RegenResult[] = []

    for (const episodeId of episodeIds) {
      const type = typeByEpisode.get(episodeId)
      if (!type) {
        results.push({
          episode_id: episodeId,
          status: 'error',
          error_message: 'Episode introuvable',
        })
        continue
      }

      let internalPath: string
      if (type === 'journal') {
        internalPath = `/api/admin/news/journal/${episodeId}/generate-audio`
      } else if (type === 'insight' || type === 'digest') {
        internalPath = `/api/admin/news/episodes/${episodeId}/generate-audio`
      } else {
        results.push({
          episode_id: episodeId,
          status: 'error',
          error_message: `Type d'episode non géré : ${type}`,
        })
        continue
      }

      const internalUrl = `${origin}${internalPath}?regenerate=true`

      try {
        const res = await fetch(internalUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Forward la session pour que isSuperAdmin() downstream passe
            cookie: cookieHeader,
          },
          body: '{}',
        })

        if (res.ok) {
          results.push({ episode_id: episodeId, status: 'success' })
        } else {
          let errorMessage = `HTTP ${res.status}`
          try {
            const body = await res.json()
            if (
              body &&
              typeof body === 'object' &&
              'error' in body &&
              typeof (body as { error: unknown }).error === 'string'
            ) {
              errorMessage = (body as { error: string }).error
            }
          } catch {
            // body non-JSON ou vide — garder errorMessage par défaut
          }
          results.push({
            episode_id: episodeId,
            status: 'error',
            error_message: errorMessage,
          })
        }
      } catch (err) {
        results.push({
          episode_id: episodeId,
          status: 'error',
          error_message: err instanceof Error ? err.message : 'Erreur réseau',
        })
      }
      // Pas d'abort sur erreur — on continue le batch
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error(
      'Erreur API admin/news/syntheses/[id]/regenerate-linked-episodes POST:',
      error,
    )
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
