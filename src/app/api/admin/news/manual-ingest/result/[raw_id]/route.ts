import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'drfantin@gmail.com'

const RELEVANCE_THRESHOLD = 0.7

// GET: lecture seule de l'état du pipeline pour un raw_id manuel.
// Sécurité : refuse les raw qui ne viennent pas de la source 'manual'.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ raw_id: string }> }
) {
  try {
    const { raw_id } = await params

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const adminSupabase = createAdminClient()

    const { data: raw, error: rawError } = await adminSupabase
      .from('news_raw')
      .select(
        'id, title, journal, doi, url, ingested_at, source:news_sources(type)'
      )
      .eq('id', raw_id)
      .maybeSingle()

    if (rawError) {
      console.error('Erreur lecture news_raw:', rawError)
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
        { error: 'Cet endpoint est réservé aux articles ingérés manuellement' },
        { status: 403 }
      )
    }

    const { data: scored, error: scoredError } = await adminSupabase
      .from('news_scored')
      .select('id, relevance_score, reasoning, status, scored_at')
      .eq('raw_id', raw_id)
      .order('scored_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (scoredError) {
      console.error('Erreur lecture news_scored:', scoredError)
      return NextResponse.json({ error: scoredError.message }, { status: 500 })
    }

    const { data: synthesis, error: synthError } = await adminSupabase
      .from('news_syntheses')
      .select(
        'id, display_title, status, failed_attempts, validation_errors, created_at'
      )
      .eq('raw_id', raw_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (synthError) {
      console.error('Erreur lecture news_syntheses:', synthError)
      return NextResponse.json({ error: synthError.message }, { status: 500 })
    }

    const scoringState = scored
      ? {
          status: 'done' as const,
          relevance_score: scored.relevance_score,
          is_eligible:
            typeof scored.relevance_score === 'number' &&
            scored.relevance_score >= RELEVANCE_THRESHOLD,
          reasoning: scored.reasoning,
          scored_at: scored.scored_at,
          internal_status: scored.status,
        }
      : { status: 'pending' as const }

    let synthesisState:
      | {
          status: 'pending' | 'done' | 'failed' | 'failed_permanent'
          id?: string
          display_title?: string | null
          failed_attempts?: number
          validation_errors?: unknown
          created_at?: string
        }
      | null = synthesis
      ? {
          status:
            synthesis.status === 'active'
              ? 'done'
              : synthesis.status === 'failed'
                ? 'failed'
                : synthesis.status === 'failed_permanent'
                  ? 'failed_permanent'
                  : 'pending',
          id: synthesis.id,
          display_title: synthesis.display_title,
          failed_attempts: synthesis.failed_attempts ?? 0,
          validation_errors: synthesis.validation_errors ?? null,
          created_at: synthesis.created_at,
        }
      : { status: 'pending' as const }

    const overall = computeOverall(scoringState, synthesisState)

    return NextResponse.json({
      state: {
        raw: {
          id: raw.id,
          title: raw.title,
          journal: raw.journal,
          doi: raw.doi,
          url: raw.url,
          ingested_at: raw.ingested_at,
        },
        scoring: scoringState,
        synthesis: synthesisState,
        overall,
      },
    })

  } catch (error) {
    console.error('Erreur API admin/news/manual-ingest/result/[raw_id]:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

type ScoringState =
  | { status: 'pending' }
  | {
      status: 'done'
      relevance_score: number | null
      is_eligible: boolean
      reasoning: string | null
      scored_at: string
      internal_status: string
    }
type SynthesisState = {
  status: 'pending' | 'done' | 'failed' | 'failed_permanent'
}

function computeOverall(
  scoring: ScoringState,
  synthesis: SynthesisState | null
):
  | 'scoring'
  | 'not_eligible'
  | 'synthesizing'
  | 'success'
  | 'failed'
  | 'failed_permanent' {
  if (scoring.status === 'pending') return 'scoring'
  if (!scoring.is_eligible) return 'not_eligible'
  if (!synthesis || synthesis.status === 'pending') return 'synthesizing'
  if (synthesis.status === 'done') return 'success'
  if (synthesis.status === 'failed') return 'failed'
  if (synthesis.status === 'failed_permanent') return 'failed_permanent'
  return 'synthesizing'
}
