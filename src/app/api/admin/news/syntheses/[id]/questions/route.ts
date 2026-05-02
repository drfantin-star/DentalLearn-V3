import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'

// GET: Liste des questions liées à une synthèse, ordre de présentation croissant
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const adminSupabase = createAdminClient()

    const { data, error } = await adminSupabase
      .from('questions')
      .select(
        'id, question_order, question_type, question_text, options, feedback_correct, feedback_incorrect, points, recommended_time_seconds, difficulty, is_daily_quiz_eligible, created_at'
      )
      .eq('news_synthesis_id', id)
      .order('question_order', { ascending: true })

    if (error) {
      console.error('Erreur chargement questions news:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ questions: data ?? [] })

  } catch (error) {
    console.error('Erreur API admin/news/syntheses/[id]/questions GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
