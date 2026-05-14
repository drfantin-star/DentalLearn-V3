import { NextRequest, NextResponse } from 'next/server'
import { requireFormateur } from '@/middleware'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { LiveEventSchema } from '@/lib/schemas/live-event'

export const dynamic = 'force-dynamic'

// PATCH /api/formateur/events/[id]
// Édite un event existant (ownership vérifié)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const redirect = await requireFormateur(request)
  if (redirect) return redirect

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Ownership check
  const { data: event } = await supabase
    .from('live_events')
    .select('id, formateur_user_id, deleted_at')
    .eq('id', params.id)
    .single()

  if (!event || event.deleted_at !== null) {
    return NextResponse.json({ error: 'Événement introuvable' }, { status: 404 })
  }

  const isAdmin = await isSuperAdmin(user.id)
  if (event.formateur_user_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const parsed = LiveEventSchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const payload = parsed.data
  if ('external_registration_url' in payload && payload.external_registration_url === '') {
    payload.external_registration_url = null
  }

  const { data, error } = await supabase
    .from('live_events')
    .update(payload)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  return NextResponse.json(data)
}

// DELETE /api/formateur/events/[id]
// Soft delete : set deleted_at = now()
// 409 si l'event est publié (dépublier d'abord)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const redirect = await requireFormateur(request)
  if (redirect) return redirect

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Ownership check
  const { data: event } = await supabase
    .from('live_events')
    .select('id, formateur_user_id, is_published, deleted_at')
    .eq('id', params.id)
    .single()

  if (!event || event.deleted_at !== null) {
    return NextResponse.json({ error: 'Événement introuvable' }, { status: 404 })
  }

  const isAdmin = await isSuperAdmin(user.id)
  if (event.formateur_user_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  }

  // Bloquer la suppression d'un event publié
  if (event.is_published) {
    return NextResponse.json(
      { error: 'Dépubliez cet événement avant de le supprimer' },
      { status: 409 }
    )
  }

  // Soft delete
  const { error } = await supabase
    .from('live_events')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
