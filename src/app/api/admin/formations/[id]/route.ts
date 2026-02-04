import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'drfantin@gmail.com'

// GET: Get a single formation
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

    if (session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const adminSupabase = createAdminClient()

    const { data, error } = await adminSupabase
      .from('formations')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Erreur chargement formation:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ formation: data })

  } catch (error) {
    console.error('Erreur API admin/formations/[id] GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH: Update a formation (including publish toggle)
export async function PATCH(
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

    if (session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const body = await request.json()

    const adminSupabase = createAdminClient()

    const { data, error } = await adminSupabase
      .from('formations')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Erreur mise à jour formation:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, formation: data })

  } catch (error) {
    console.error('Erreur API admin/formations/[id] PATCH:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE: Delete a formation
export async function DELETE(
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

    if (session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const adminSupabase = createAdminClient()

    // Supprimer en cascade (les séquences et questions seront supprimées via ON DELETE CASCADE en BDD)
    const { error } = await adminSupabase
      .from('formations')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Erreur suppression formation:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Erreur API admin/formations/[id] DELETE:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
