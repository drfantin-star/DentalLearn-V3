import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  NEWS_SPECIALITES_SET,
  NEWS_NIVEAU_PREUVE_SET,
  NEWS_CATEGORIES_EDITORIALES_SET,
} from '@/lib/constants/news'

// Limites & règles métier T7-ter (mode "enriched" du formulaire admin).
const TITLE_MIN = 5
const TITLE_MAX = 300
const DISPLAY_TITLE_MAX = 70
const SUMMARY_MIN = 100
const QUESTIONS_MIN = 3
const QUESTIONS_MAX = 4
const EMBEDDING_DIM = 1536
const ALLOWED_QUESTION_TYPES = new Set<'mcq' | 'true_false'>(['mcq', 'true_false'])
const DOI_REGEX = /^10\.\d{4,9}\/[-._;()/:a-zA-Z0-9]+$/

interface ValidationError {
  field: string
  message: string
}

interface CleanQuestion {
  question_type: 'mcq' | 'true_false'
  text: string
  options: Array<{ id: string; text: string; correct: boolean }>
  feedback: string
  difficulty?: number
  points?: number
  recommended_time_seconds?: number
}

// POST : ingestion enrichie d'un article (article + synthèse + 3-4 questions)
// via la RPC atomique insert_manual_enriched_article. L'embedding est calculé
// côté serveur via OpenAI text-embedding-3-small (1536 dims), puis passé à la
// RPC qui fait les 4 INSERTs (news_raw + news_scored + news_syntheses + N
// questions) dans la même transaction.
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
    }
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
    }

    const errors: ValidationError[] = []

    // ------------------------------------------------------------------
    // Métadonnées article
    // ------------------------------------------------------------------
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) {
      errors.push({ field: 'title', message: 'Titre requis' })
    } else if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
      errors.push({
        field: 'title',
        message: `Titre doit contenir entre ${TITLE_MIN} et ${TITLE_MAX} caractères`,
      })
    }

    const doiRaw = typeof body.doi === 'string' ? body.doi.trim() : ''
    const doi = doiRaw || null
    if (doi && !DOI_REGEX.test(doi)) {
      errors.push({ field: 'doi', message: 'Format DOI invalide' })
    }

    const journal =
      typeof body.journal === 'string' && body.journal.trim()
        ? body.journal.trim()
        : null
    const authors =
      typeof body.authors === 'string' && body.authors.trim()
        ? body.authors.trim()
        : null
    const abstract =
      typeof body.abstract === 'string' && body.abstract.trim()
        ? body.abstract.trim()
        : null

    let url: string | null = null
    if (typeof body.url === 'string' && body.url.trim()) {
      const u = body.url.trim()
      try {
        const parsed = new URL(u)
        if (!/^https?:$/.test(parsed.protocol)) {
          errors.push({ field: 'url', message: 'URL doit être http(s)' })
        } else {
          url = u
        }
      } catch {
        errors.push({ field: 'url', message: 'URL invalide' })
      }
    }

    const spe_tags: string[] = []
    if (Array.isArray(body.spe_tags)) {
      const invalid: string[] = []
      for (const tag of body.spe_tags) {
        if (typeof tag !== 'string') continue
        if (!NEWS_SPECIALITES_SET.has(tag)) {
          invalid.push(tag)
        } else if (!spe_tags.includes(tag)) {
          spe_tags.push(tag)
        }
      }
      if (invalid.length > 0) {
        errors.push({
          field: 'spe_tags',
          message: `Spécialités hors taxonomy : ${invalid.join(', ')}`,
        })
      }
    }

    // ------------------------------------------------------------------
    // Champs synthèse
    // ------------------------------------------------------------------
    const display_title =
      typeof body.display_title === 'string' ? body.display_title.trim() : ''
    if (!display_title) {
      errors.push({ field: 'display_title', message: 'Titre éditorial requis' })
    } else if (display_title.length > DISPLAY_TITLE_MAX) {
      errors.push({
        field: 'display_title',
        message: `Titre éditorial limité à ${DISPLAY_TITLE_MAX} caractères`,
      })
    }

    const summary_fr =
      typeof body.summary_fr === 'string' ? body.summary_fr.trim() : ''
    if (!summary_fr) {
      errors.push({ field: 'summary_fr', message: 'Résumé requis' })
    } else if (summary_fr.length < SUMMARY_MIN) {
      errors.push({
        field: 'summary_fr',
        message: `Résumé doit faire au moins ${SUMMARY_MIN} caractères`,
      })
    }

    const clinical_impact =
      typeof body.clinical_impact === 'string' && body.clinical_impact.trim()
        ? body.clinical_impact.trim()
        : null
    const caveats =
      typeof body.caveats === 'string' && body.caveats.trim()
        ? body.caveats.trim()
        : null

    let evidence_level: string | null = null
    if (typeof body.evidence_level === 'string' && body.evidence_level.trim()) {
      const v = body.evidence_level.trim()
      if (!NEWS_NIVEAU_PREUVE_SET.has(v)) {
        errors.push({
          field: 'evidence_level',
          message: 'Niveau de preuve hors taxonomy',
        })
      } else {
        evidence_level = v
      }
    }

    let category_editorial: string | null = null
    if (
      typeof body.category_editorial === 'string' &&
      body.category_editorial.trim()
    ) {
      const v = body.category_editorial.trim()
      if (!NEWS_CATEGORIES_EDITORIALES_SET.has(v)) {
        errors.push({
          field: 'category_editorial',
          message: 'Catégorie éditoriale invalide',
        })
      } else {
        category_editorial = v
      }
    }

    const formation_category_match =
      typeof body.formation_category_match === 'string' &&
      body.formation_category_match.trim()
        ? body.formation_category_match.trim()
        : null

    let specialite: string | null = null
    if (typeof body.specialite === 'string' && body.specialite.trim()) {
      const v = body.specialite.trim()
      if (!NEWS_SPECIALITES_SET.has(v)) {
        errors.push({
          field: 'specialite',
          message: 'Spécialité hors taxonomy',
        })
      } else {
        specialite = v
      }
    }

    const key_figures: string[] = []
    if (Array.isArray(body.key_figures)) {
      for (const fig of body.key_figures) {
        if (typeof fig === 'string' && fig.trim()) {
          key_figures.push(fig.trim())
        }
      }
    }

    // ------------------------------------------------------------------
    // Questions
    // ------------------------------------------------------------------
    const rawQuestions = Array.isArray(body.questions) ? body.questions : []
    if (rawQuestions.length < QUESTIONS_MIN) {
      errors.push({
        field: 'questions',
        message: `Minimum ${QUESTIONS_MIN} questions requises (reçu : ${rawQuestions.length})`,
      })
    } else if (rawQuestions.length > QUESTIONS_MAX) {
      errors.push({
        field: 'questions',
        message: `Maximum ${QUESTIONS_MAX} questions autorisées`,
      })
    }

    const validQuestions: CleanQuestion[] = []
    rawQuestions.forEach((q: any, i: number) => {
      const prefix = `questions[${i}]`
      if (!q || typeof q !== 'object') {
        errors.push({ field: prefix, message: 'Question invalide' })
        return
      }
      if (!ALLOWED_QUESTION_TYPES.has(q.question_type)) {
        errors.push({
          field: `${prefix}.question_type`,
          message: 'Type doit être mcq ou true_false',
        })
        return
      }
      const qText = typeof q.text === 'string' ? q.text.trim() : ''
      if (!qText) {
        errors.push({ field: `${prefix}.text`, message: 'Énoncé requis' })
        return
      }
      const qOptions = Array.isArray(q.options) ? q.options : []
      if (q.question_type === 'mcq' && qOptions.length < 2) {
        errors.push({
          field: `${prefix}.options`,
          message: 'MCQ requiert au moins 2 options',
        })
        return
      }
      if (q.question_type === 'true_false' && qOptions.length !== 2) {
        errors.push({
          field: `${prefix}.options`,
          message: 'Vrai/Faux requiert exactement 2 options',
        })
        return
      }
      const correctCount = qOptions.filter(
        (o: any) => o && o.correct === true,
      ).length
      if (correctCount !== 1) {
        errors.push({
          field: `${prefix}.options`,
          message: 'Exactement une option doit être marquée correcte',
        })
        return
      }
      const cleanedOptions: Array<{ id: string; text: string; correct: boolean }> =
        qOptions.map((o: any, idx: number) => ({
          id:
            typeof o?.id === 'string' && o.id
              ? o.id
              : String.fromCharCode(65 + idx),
          text: typeof o?.text === 'string' ? o.text.trim() : '',
          correct: o?.correct === true,
        }))
      if (cleanedOptions.some((o) => !o.text)) {
        errors.push({
          field: `${prefix}.options`,
          message: 'Chaque option doit avoir un texte',
        })
        return
      }
      const feedback = typeof q.feedback === 'string' ? q.feedback.trim() : ''
      if (!feedback) {
        errors.push({
          field: `${prefix}.feedback`,
          message: 'Feedback requis',
        })
        return
      }
      const difficulty =
        typeof q.difficulty === 'number' && q.difficulty >= 1 && q.difficulty <= 3
          ? q.difficulty
          : undefined
      const points =
        typeof q.points === 'number' && q.points > 0 ? q.points : undefined
      const recommended_time_seconds =
        typeof q.recommended_time_seconds === 'number' &&
        q.recommended_time_seconds > 0
          ? q.recommended_time_seconds
          : undefined

      validQuestions.push({
        question_type: q.question_type,
        text: qText,
        options: cleanedOptions,
        feedback,
        difficulty,
        points,
        recommended_time_seconds,
      })
    })

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation échouée', details: errors },
        { status: 400 },
      )
    }

    // ------------------------------------------------------------------
    // Embedding OpenAI (text-embedding-3-small, 1536 dims)
    // ------------------------------------------------------------------
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      console.error('OPENAI_API_KEY missing for manual-enriched ingestion')
      return NextResponse.json(
        {
          error:
            'Clé OpenAI manquante côté serveur — contacter l\'équipe technique',
        },
        { status: 503 },
      )
    }
    const embeddingRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: `${display_title} ${summary_fr}`,
        dimensions: EMBEDDING_DIM,
      }),
    })
    if (!embeddingRes.ok) {
      const text = await embeddingRes.text().catch(() => '')
      console.error(
        'OpenAI embedding error',
        embeddingRes.status,
        text.slice(0, 500),
      )
      return NextResponse.json(
        { error: `Embedding OpenAI échoué (${embeddingRes.status})` },
        { status: 502 },
      )
    }
    const embJson = await embeddingRes.json()
    const embedding: unknown = embJson?.data?.[0]?.embedding
    if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIM) {
      console.error('OpenAI embedding malformed:', JSON.stringify(embJson).slice(0, 500))
      return NextResponse.json(
        { error: 'Réponse embedding OpenAI invalide' },
        { status: 502 },
      )
    }
    // pgvector accepte le format texte "[v1,v2,...]" via le protocole RPC
    // (le client supabase-js sérialise nos arguments en JSON ; pour un
    // type vector côté Postgres, la string est convertie sans ambiguïté).
    const embeddingLiteral = `[${(embedding as number[]).join(',')}]`

    // ------------------------------------------------------------------
    // Source manual_admin
    // ------------------------------------------------------------------
    const adminSupabase = createAdminClient()
    const { data: source, error: sourceError } = await adminSupabase
      .from('news_sources')
      .select('id')
      .eq('type', 'manual_admin')
      .single()
    if (sourceError || !source) {
      console.error('Source manual_admin introuvable:', sourceError)
      return NextResponse.json(
        { error: 'Source manual_admin non configurée — relancer la migration' },
        { status: 500 },
      )
    }

    // ------------------------------------------------------------------
    // RPC atomique
    // ------------------------------------------------------------------
    const { data: synthesisId, error: rpcError } = await adminSupabase.rpc(
      'insert_manual_enriched_article',
      {
        p_title: title,
        p_source_id: source.id,
        p_questions: validQuestions,
        p_doi: doi,
        p_journal: journal,
        p_authors: authors,
        p_abstract: abstract,
        p_url: url,
        p_spe_tags: spe_tags,
        p_display_title: display_title,
        p_summary_fr: summary_fr,
        p_clinical_impact: clinical_impact,
        p_evidence_level: evidence_level,
        p_key_figures: key_figures,
        p_caveats: caveats,
        p_category_editorial: category_editorial,
        p_formation_category_match: formation_category_match,
        p_specialite: specialite,
        p_embedding: embeddingLiteral,
        p_added_by: session.user.id,
      },
    )

    if (rpcError) {
      console.error('RPC insert_manual_enriched_article failed:', rpcError)
      return NextResponse.json(
        { error: rpcError.message ?? 'Erreur RPC' },
        { status: 500 },
      )
    }

    return NextResponse.json(
      { synthesis_id: synthesisId },
      { status: 201 },
    )
  } catch (error) {
    console.error('Erreur API admin/news/manual-enriched POST:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
