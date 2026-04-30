import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'drfantin@gmail.com'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

const ALLOWED_SORTS = new Set(['created_at_desc', 'created_at_asc'])
const ALLOWED_STATUSES = new Set(['pending', 'approved'])

function sanitizeSearchTerm(q: string): string {
  return q.replace(/[,()%]/g, '').trim()
}

// !inner sur news_syntheses : (1) impose la présence du parent (équivalent
// à .not('news_synthesis_id', 'is', null), redondant mais explicite) et
// (2) permet aux .eq('news_syntheses.<col>', value) de filtrer les lignes
// parentes (sans !inner, le filtre n'agit que sur la relation embarquée et
// laisse passer toutes les questions).
const SELECT_COLUMNS =
  'id, question_order, question_type, question_text, options, ' +
  'feedback_correct, feedback_incorrect, points, recommended_time_seconds, ' +
  'difficulty, is_daily_quiz_eligible, created_at, news_synthesis_id, ' +
  'news_syntheses!inner(id, display_title, specialite, niveau_preuve, formation_category_match)'

// GET: liste paginée des questions news, filtrables par status d'approbation
// (pending = is_daily_quiz_eligible=false, approved = true), specialite (sur
// la synthèse parente), recherche full-text sur question_text.
//
// Renvoie aussi un bloc { counts: { pending, approved } } global (deux
// requêtes count en parallèle) pour alimenter les compteurs globaux côté UI.
export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)

    const pageRaw = parseInt(searchParams.get('page') || '1', 10)
    const limitRaw = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10)
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1
    const limit = Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, MAX_LIMIT)
      : DEFAULT_LIMIT

    const statusParam = searchParams.get('status') ?? 'pending'
    const status = ALLOWED_STATUSES.has(statusParam) ? statusParam : 'pending'
    const isApproved = status === 'approved'

    const sortParam = searchParams.get('sort') ?? 'created_at_desc'
    const sort = ALLOWED_SORTS.has(sortParam) ? sortParam : 'created_at_desc'

    const specialite = searchParams.get('specialite')
    const qRaw = searchParams.get('q')
    const q = qRaw ? sanitizeSearchTerm(qRaw) : ''

    const adminSupabase = createAdminClient()

    let query = adminSupabase
      .from('questions')
      .select(SELECT_COLUMNS, { count: 'exact' })
      .not('news_synthesis_id', 'is', null)
      .eq('is_daily_quiz_eligible', isApproved)

    if (specialite) {
      // Filtre via la table jointe — Supabase JS supporte la syntaxe
      // 'parent_table.column' pour les filtres sur relations.
      query = query.eq('news_syntheses.specialite', specialite)
    }
    if (q) {
      query = query.ilike('question_text', `%${q}%`)
    }

    query = query.order('created_at', { ascending: sort === 'created_at_asc' })

    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    // Compteurs globaux pending / approved en parallèle (head: true → pas de
    // payload data, juste le count).
    const countsPromise = Promise.all([
      adminSupabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .not('news_synthesis_id', 'is', null)
        .eq('is_daily_quiz_eligible', false),
      adminSupabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .not('news_synthesis_id', 'is', null)
        .eq('is_daily_quiz_eligible', true),
    ])

    const [{ data, error, count }, [pendingRes, approvedRes]] = await Promise.all([
      query,
      countsPromise,
    ])

    if (error) {
      console.error('Erreur chargement questions news:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (pendingRes.error) {
      console.error('Erreur count pending:', pendingRes.error)
    }
    if (approvedRes.error) {
      console.error('Erreur count approved:', approvedRes.error)
    }

    const questions = (data ?? []).map((row: any) => {
      const synthJoin = Array.isArray(row.news_syntheses)
        ? row.news_syntheses[0]
        : row.news_syntheses
      return {
        id: row.id,
        question_order: row.question_order,
        question_type: row.question_type,
        question_text: row.question_text,
        options: row.options,
        feedback_correct: row.feedback_correct,
        feedback_incorrect: row.feedback_incorrect,
        points: row.points,
        recommended_time_seconds: row.recommended_time_seconds,
        difficulty: row.difficulty,
        is_daily_quiz_eligible: row.is_daily_quiz_eligible,
        created_at: row.created_at,
        news_synthesis_id: row.news_synthesis_id,
        synthesis: synthJoin
          ? {
              id: synthJoin.id,
              display_title: synthJoin.display_title,
              specialite: synthJoin.specialite,
              niveau_preuve: synthJoin.niveau_preuve,
              formation_category_match: synthJoin.formation_category_match,
            }
          : null,
      }
    })

    const total = count ?? 0
    const total_pages = total === 0 ? 0 : Math.ceil(total / limit)

    return NextResponse.json({
      questions,
      total,
      page,
      limit,
      total_pages,
      counts: {
        pending: pendingRes.count ?? 0,
        approved: approvedRes.count ?? 0,
      },
    })

  } catch (error) {
    console.error('Erreur API admin/news/questions GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
