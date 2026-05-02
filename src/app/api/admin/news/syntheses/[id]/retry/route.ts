import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'

// POST: reset des champs BDD d'une synthèse en échec.
// Aucune invocation de l'edge function — l'article repassera dans la file
// du cron synthesize_articles au prochain run hebdomadaire (lundi 20h ou
// 22h UTC). Décision PO1 verrouillée Ticket 8 (recommandation b).
export async function POST(
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

    const { data: existing, error: fetchError } = await adminSupabase
      .from('news_syntheses')
      .select('id, status')
      .eq('id', id)
      .single()

    if (fetchError) {
      const status = fetchError.code === 'PGRST116' ? 404 : 500
      console.error('Erreur lecture synthèse pour retry:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status })
    }

    if (existing.status !== 'failed' && existing.status !== 'failed_permanent') {
      return NextResponse.json(
        {
          error: `Cette synthèse n'est pas en échec (status actuel : ${existing.status})`,
        },
        { status: 400 }
      )
    }

    const { data, error } = await adminSupabase
      .from('news_syntheses')
      .update({
        status: 'failed',
        failed_attempts: 0,
        validation_errors: null,
        validation_warnings: null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Erreur reset retry synthèse:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      synthesis: data,
      message:
        'Reset effectué. La synthèse sera retraitée au prochain cron synthesize_articles (lundi 20h ou 22h UTC).',
    })

  } catch (error) {
    console.error('Erreur API admin/news/syntheses/[id]/retry:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
