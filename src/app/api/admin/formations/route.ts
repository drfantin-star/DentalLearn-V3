import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'drfantin@gmail.com'

// GET: List all formations (including drafts)
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const adminSupabase = createAdminClient()

    const { data, error } = await adminSupabase
      .from('formations')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erreur chargement formations:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ formations: data })

  } catch (error) {
    console.error('Erreur API admin/formations GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST: Create a new formation
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const body = await request.json()

    const adminSupabase = createAdminClient()

    const { data, error } = await adminSupabase
      .from('formations')
      .insert([{ ...body, is_published: false }])
      .select()
      .single()

    if (error) {
      console.error('Erreur création formation:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, formation: data })

  } catch (error) {
    console.error('Erreur API admin/formations POST:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
