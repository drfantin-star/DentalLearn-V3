import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { regenerateSynthesisFromFullText, SONNET_MODEL } from '@/lib/news/regenerate-fulltext-sonnet'
import type { FullTextArticle } from '@/lib/news/regenerate-fulltext-prompt'
import {
  CATEGORY_EDITORIAL_VALUES,
  type TaxonomyLists,
} from '@/lib/news/regenerate-fulltext-validators'

// Route nodejs longue — necessite Vercel Pro (cf CLAUDE.md « Vercel Pro
// dependencies »). La generation Sonnet part d'un TEXTE INTEGRAL (plus long
// qu'un abstract : synthesize_articles mesure ~43s depuis un abstract), une
// coupure a 45s est structurellement intenable. maxDuration=300 aligne sur le
// plafond du plan (routes generate-script / generate-audio / regenerate-linked
// -episodes tournent deja a 300 en prod). Le timeout AbortController (240s cote
// sonnet) laisse ~60s de marge pour l'embedding + la RPC.
export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

// Bornes du texte integral (brief 4.2, controle 5). Le minimum evite de degrader
// une synthese en collant un texte plus pauvre que l'abstract d'origine ; le
// maximum protege du cout et du timeout.
const FULLTEXT_MIN = 2_000
const FULLTEXT_MAX = 60_000

const EMBEDDING_DIM = 1536

// POST : regenere une synthese NON validee editorialement + ses questions a
// partir du texte integral colle. UPDATE en place (id preserve) via la RPC
// atomique regenerate_synthesis_from_fulltext. Aucune ecriture si l'appel Sonnet
// echoue — la synthese d'origine reste intacte.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    // ----- Garde 1 : auth super admin -----
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    // ----- Parse body -----
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
    }
    const fullText =
      body && typeof body === 'object' && typeof (body as { fullText?: unknown }).fullText === 'string'
        ? (body as { fullText: string }).fullText.trim()
        : ''

    // ----- Garde 5 (avant tout appel LLM payant) : longueur du texte -----
    if (fullText.length < FULLTEXT_MIN) {
      return NextResponse.json(
        { error: `Texte trop court (${fullText.length} / min ${FULLTEXT_MIN} caractères)` },
        { status: 400 },
      )
    }
    if (fullText.length > FULLTEXT_MAX) {
      return NextResponse.json(
        { error: `Texte trop long (${fullText.length} / max ${FULLTEXT_MAX} caractères)` },
        { status: 400 },
      )
    }

    const adminSupabase = createAdminClient()

    // ----- Garde 2 : synthese existe + garde 3 : is_editorially_validated -----
    const { data: synth, error: synthError } = await adminSupabase
      .from('news_syntheses')
      .select('id, raw_id, status, is_editorially_validated')
      .eq('id', id)
      .maybeSingle()

    if (synthError) {
      console.error('Erreur lecture synthèse pour regeneration:', synthError)
      return NextResponse.json({ error: synthError.message }, { status: 500 })
    }
    if (!synth) {
      return NextResponse.json({ error: 'Synthèse introuvable' }, { status: 404 })
    }
    // Relu en base, jamais depuis le client (invariant D1).
    if (synth.is_editorially_validated === true) {
      return NextResponse.json(
        { error: 'Synthèse validée éditorialement — régénération impossible' },
        { status: 403 },
      )
    }

    // ----- Garde 4 : aucune reference episode / insight non archive -----
    const { count: episodeSynthCount, error: esErr } = await adminSupabase
      .from('news_episode_syntheses')
      .select('synthesis_id', { count: 'exact', head: true })
      .eq('synthesis_id', id)
    if (esErr) {
      console.error('Erreur vérif news_episode_syntheses:', esErr)
      return NextResponse.json({ error: esErr.message }, { status: 500 })
    }
    if ((episodeSynthCount ?? 0) > 0) {
      return NextResponse.json(
        { error: 'Synthèse déjà utilisée dans un épisode news — régénération impossible' },
        { status: 409 },
      )
    }

    const { data: episodeItems, error: eiErr } = await adminSupabase
      .from('news_episode_items')
      .select('id, episode:news_episodes!inner(status)')
      .eq('synthesis_id', id)
    if (eiErr) {
      console.error('Erreur vérif news_episode_items:', eiErr)
      return NextResponse.json({ error: eiErr.message }, { status: 500 })
    }
    const hasActiveInsight = (episodeItems ?? []).some((it) => {
      const ep = (it as { episode?: { status?: string } | { status?: string }[] }).episode
      const status = Array.isArray(ep) ? ep[0]?.status : ep?.status
      return status !== undefined && status !== 'archived'
    })
    if (hasActiveInsight) {
      return NextResponse.json(
        { error: 'Synthèse déjà utilisée dans un insight audio actif — régénération impossible' },
        { status: 409 },
      )
    }

    // ----- Metadonnees article (news_raw) -----
    let article: FullTextArticle = {
      title: '(titre indisponible)',
      journal: null,
      published_at: null,
      authors: null,
      doi: null,
      url: null,
      full_text: fullText,
    }
    if (synth.raw_id) {
      const { data: raw } = await adminSupabase
        .from('news_raw')
        .select('title, journal, published_at, authors, doi, url')
        .eq('id', synth.raw_id)
        .maybeSingle()
      if (raw) {
        article = {
          title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : article.title,
          journal: raw.journal ?? null,
          published_at: raw.published_at ?? null,
          authors: Array.isArray(raw.authors) ? raw.authors : null,
          doi: raw.doi ?? null,
          url: raw.url ?? null,
          full_text: fullText,
        }
      }
    }

    // ----- Listes de reference (taxonomy + formations.category) -----
    const lists = await loadTaxonomyLists(adminSupabase)
    if (
      lists.specialites.length === 0 ||
      lists.themes.length === 0 ||
      lists.niveaux_preuve.length === 0
    ) {
      return NextResponse.json(
        { error: 'Taxonomy news incomplète côté serveur — contacter l\'équipe technique' },
        { status: 500 },
      )
    }

    // ----- Appel Sonnet (retry tags, no-persist si echec) -----
    const regen = await regenerateSynthesisFromFullText(article, lists)
    if (!regen.ok) {
      const status = regen.stage === 'anthropic_call' ? 502 : 422
      return NextResponse.json(
        {
          error: `Échec de la régénération (${regen.stage})`,
          details: regen.errors.slice(0, 5),
          attempts: regen.attempts,
          duration_ms: regen.duration_ms,
        },
        { status },
      )
    }

    // ----- Embedding OpenAI (text-embedding-3-small, 1536 dims) -----
    const embeddingText = [regen.output.display_title, regen.output.summary_fr]
      .concat(
        Array.isArray(regen.output.key_figures)
          ? regen.output.key_figures.filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
          : [],
      )
      .join('\n')
    const embedding = await computeEmbedding(embeddingText)
    if (!embedding.ok) {
      return NextResponse.json({ error: embedding.error }, { status: embedding.status })
    }

    // ----- Questions -> jsonb pour la RPC -----
    const questionsPayload = regen.questions.map((q) => ({
      question_type: q.question_type,
      question_text: q.question_text,
      options: q.options,
      feedback: q.feedback,
      difficulty: q.difficulty,
      points: q.points,
      recommended_time_seconds: q.recommended_time_seconds,
    }))

    // ----- RPC transactionnelle (UPDATE en place + DELETE/INSERT questions) -----
    const { data: insertedCount, error: rpcError } = await adminSupabase.rpc(
      'regenerate_synthesis_from_fulltext',
      {
        p_synthesis_id: id,
        p_summary_fr: regen.output.summary_fr,
        p_display_title: regen.output.display_title,
        p_specialite: regen.output.specialite,
        p_niveau_preuve: regen.output.niveau_preuve,
        p_category_editorial: regen.output.category_editorial,
        p_questions: questionsPayload,
        p_embedding: embedding.literal,
        p_method: regen.output.method,
        p_key_figures: Array.isArray(regen.output.key_figures) ? regen.output.key_figures : [],
        p_evidence_level: regen.output.evidence_level,
        p_clinical_impact: regen.output.clinical_impact,
        p_caveats: regen.output.caveats,
        p_themes: Array.isArray(regen.output.themes) ? regen.output.themes : [],
        p_keywords_libres: Array.isArray(regen.output.keywords_libres) ? regen.output.keywords_libres : [],
        p_formation_category_match: regen.output.formation_category_match,
        p_llm_model: SONNET_MODEL,
        p_edited_by: session.user.id,
      },
    )

    if (rpcError) {
      console.error('RPC regenerate_synthesis_from_fulltext failed:', rpcError)
      return NextResponse.json({ error: rpcError.message ?? 'Erreur RPC' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      synthesis_id: id,
      questions_count: typeof insertedCount === 'number' ? insertedCount : regen.questions.length,
      tokens: regen.tokens,
      attempts: regen.attempts,
    })
  } catch (error) {
    console.error('Erreur API admin/news/syntheses/[id]/regenerate POST:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadTaxonomyLists(
  adminSupabase: ReturnType<typeof createAdminClient>,
): Promise<TaxonomyLists> {
  const specialites: string[] = []
  const themes: string[] = []
  const niveaux_preuve: string[] = []
  const formation_categories = new Set<string>()

  const { data: taxonomy } = await adminSupabase
    .from('news_taxonomy')
    .select('type, slug')
    .eq('active', true)
  for (const r of taxonomy ?? []) {
    if (typeof r?.slug !== 'string') continue
    if (r.type === 'specialite') specialites.push(r.slug)
    else if (r.type === 'theme') themes.push(r.slug)
    else if (r.type === 'niveau_preuve') niveaux_preuve.push(r.slug)
  }

  const { data: formations } = await adminSupabase
    .from('formations')
    .select('category')
    .not('category', 'is', null)
  for (const f of formations ?? []) {
    if (typeof f?.category === 'string' && f.category.trim()) {
      formation_categories.add(f.category.trim())
    }
  }

  return {
    specialites,
    themes,
    niveaux_preuve,
    formation_categories: Array.from(formation_categories).sort(),
    category_editorial: [...CATEGORY_EDITORIAL_VALUES],
  }
}

type EmbeddingResult =
  | { ok: true; literal: string }
  | { ok: false; error: string; status: number }

async function computeEmbedding(text: string): Promise<EmbeddingResult> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    console.error('OPENAI_API_KEY missing for synthesis regeneration')
    return { ok: false, error: 'Clé OpenAI manquante côté serveur', status: 503 }
  }
  let res: Response
  try {
    res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
        dimensions: EMBEDDING_DIM,
      }),
    })
  } catch (e) {
    console.error('OpenAI embedding fetch failed:', e)
    return { ok: false, error: 'Appel embedding OpenAI échoué', status: 502 }
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    console.error('OpenAI embedding error', res.status, t.slice(0, 500))
    return { ok: false, error: `Embedding OpenAI échoué (${res.status})`, status: 502 }
  }
  const json = await res.json()
  const vec: unknown = json?.data?.[0]?.embedding
  if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIM) {
    console.error('OpenAI embedding malformed:', JSON.stringify(json).slice(0, 300))
    return { ok: false, error: 'Réponse embedding OpenAI invalide', status: 502 }
  }
  return { ok: true, literal: `[${(vec as number[]).join(',')}]` }
}
