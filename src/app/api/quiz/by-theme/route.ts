import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NEWS_SPECIALITES_SET } from '@/lib/constants/news'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 20
const MIN_PLAYABLE = 8

const QUIZ_COLUMNS = [
  'id', 'question_type', 'question_text', 'options',
  'feedback_correct', 'feedback_incorrect', 'image_url',
  'recommended_time_seconds', 'difficulty', 'news_synthesis_id',
].join(', ')

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const specialite = searchParams.get('specialite')
    const limitRaw = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)

    if (!specialite || !NEWS_SPECIALITES_SET.has(specialite)) {
      return NextResponse.json({ error: 'Parametre `specialite` invalide' }, { status: 400 })
    }

    const limit = Math.min(Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : DEFAULT_LIMIT, MAX_LIMIT)

    const admin = createAdminClient()

    // Verrou editorial : on ne retient que les syntheses validees par le
    // comite au niveau de la SELECTION des newsIds. Les questions elles-memes
    // ne sont pas filtrees (decision : le pool du quiz par theme reste tel
    // quel), mais elles sont rattachees a une synthese validee.
    const { data: newsRows, error: nErr } = await admin
      .from('news_syntheses')
      .select('id, display_title')
      .eq('status', 'active')
      .eq('is_editorially_validated', true)
      .eq('specialite', specialite)

    if (nErr) throw nErr

    const titleById = new Map<string, string>(
      (newsRows ?? []).map((r) => [r.id as string, (r.display_title as string) ?? '']),
    )

    const newsIds = (newsRows ?? []).map((r) => r.id)

    if (newsIds.length === 0) {
      return NextResponse.json({ questions: [], playable: false })
    }

    const { data: qRows, error: qErr } = await admin
      .from('questions')
      .select(QUIZ_COLUMNS)
      .in('news_synthesis_id', newsIds)
      .in('question_type', ['mcq', 'true_false', 'checkbox'])

    if (qErr) throw qErr

    const all = qRows ?? []

    if (all.length < MIN_PLAYABLE) {
      return NextResponse.json({ questions: [], playable: false })
    }

    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[all[i], all[j]] = [all[j], all[i]]
    }

    const picked = all.slice(0, limit).map((q) => ({
      ...q,
      sourceTitle: titleById.get(q.news_synthesis_id as string) ?? null,
    }))
    return NextResponse.json({ questions: picked, playable: true })
  } catch (err) {
    console.error('quiz/by-theme GET error:', err)
    return NextResponse.json({ questions: [], playable: false }, { status: 200 })
  }
}
