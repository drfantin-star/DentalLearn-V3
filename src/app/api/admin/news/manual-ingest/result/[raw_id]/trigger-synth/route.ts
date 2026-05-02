import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'

const RELEVANCE_THRESHOLD = 0.7

// POST: déclenche fire-and-forget synthesize_articles pour un raw_id manuel.
// Idempotent côté Edge Function (synthesize_articles ne re-traite pas un
// scored déjà associé à une synthèse 'active'). Garde-fous côté API :
//   - raw doit appartenir à la source 'manual'
//   - news_scored doit exister + relevance_score >= threshold
//   - aucune synthèse 'active' existante pour ce raw
// → renvoie 200 si trigger envoyé, 409 si conditions non remplies.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ raw_id: string }> }
) {
  try {
    const { raw_id } = await params

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const adminSupabase = createAdminClient()

    const { data: raw, error: rawError } = await adminSupabase
      .from('news_raw')
      .select('id, source:news_sources(type)')
      .eq('id', raw_id)
      .maybeSingle()

    if (rawError) {
      return NextResponse.json({ error: rawError.message }, { status: 500 })
    }
    if (!raw) {
      return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
    }

    const sourceJoin = Array.isArray((raw as any).source)
      ? (raw as any).source[0]
      : (raw as any).source
    if (!sourceJoin || sourceJoin.type !== 'manual') {
      return NextResponse.json(
        { error: 'Article non manuel' },
        { status: 403 }
      )
    }

    const { data: scored, error: scoredError } = await adminSupabase
      .from('news_scored')
      .select('id, relevance_score, status')
      .eq('raw_id', raw_id)
      .order('scored_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (scoredError) {
      return NextResponse.json({ error: scoredError.message }, { status: 500 })
    }
    if (!scored) {
      return NextResponse.json(
        { error: 'Article pas encore scoré' },
        { status: 409 }
      )
    }
    if (
      typeof scored.relevance_score !== 'number' ||
      scored.relevance_score < RELEVANCE_THRESHOLD
    ) {
      return NextResponse.json(
        { error: 'Article non éligible (score insuffisant)' },
        { status: 409 }
      )
    }

    const { data: existingSynth } = await adminSupabase
      .from('news_syntheses')
      .select('id, status')
      .eq('raw_id', raw_id)
      .eq('status', 'active')
      .maybeSingle()

    if (existingSynth) {
      return NextResponse.json(
        { error: 'Synthèse déjà existante', synthesis_id: existingSynth.id },
        { status: 409 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: 'Variables Supabase manquantes côté serveur' },
        { status: 500 }
      )
    }

    // Fire-and-forget — limit=5 pour absorber un éventuel backlog de scored
    // 'selected' en plus de notre article. force=false : on ne re-traite pas
    // un article déjà synthétisé en 'failed_permanent'.
    fetch(`${supabaseUrl}/functions/v1/synthesize_articles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ limit: 5, force: false }),
    }).catch((err) => {
      console.error('Trigger synthesize_articles a échoué:', err, 'raw_id:', raw_id)
    })

    return NextResponse.json({ success: true, triggered: true })

  } catch (error) {
    console.error('Erreur API trigger-synth:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
