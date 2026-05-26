import { NextRequest, NextResponse } from 'next/server'
import { requireFormateur } from '@/middleware'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { LiveSessionSchema } from '@/lib/schemas/live-session'

export const dynamic = 'force-dynamic'

// PATCH /api/formateur/sessions/[id]
// Édite une session existante (ownership vérifié).
// Cas spécial : body { status: 'cancelled' } → annulation.
//   Si des inscrits existent, retourne 409 sauf si ?force=true.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const redirect = await requireFormateur(request)
  if (redirect) return redirect

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: session } = await supabase
    .from('live_sessions')
    .select('id, formateur_user_id, deleted_at, status, is_published')
    .eq('id', params.id)
    .single()

  if (!session || session.deleted_at !== null) {
    return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  }

  const isAdmin = await isSuperAdmin(user.id)
  if (session.formateur_user_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  // Cas annulation
  if (typeof body === 'object' && body !== null && (body as Record<string, unknown>).status === 'cancelled') {
    const force = request.nextUrl.searchParams.get('force') === 'true'

    if (!force) {
      const { count } = await supabase
        .from('live_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', params.id)

      if ((count ?? 0) > 0) {
        return NextResponse.json(
          {
            error: 'Des participants sont inscrits à cette session. Ajoutez ?force=true pour confirmer l\'annulation.',
            registration_count: count,
          },
          { status: 409 }
        )
      }
    }

    const { data, error } = await supabase
      .from('live_sessions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }

    return NextResponse.json(data)
  }

  // Édition normale
  const parsed = LiveSessionSchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const payload = parsed.data
  if ('zoom_url' in payload && payload.zoom_url === '') {
    payload.zoom_url = null
  }

  const updatePayload: Record<string, unknown> = { ...payload, updated_at: new Date().toISOString() }
  // Première publication : horodater published_at pour la Edge Function de notifications
  if (payload.is_published === true && session.is_published === false) {
    updatePayload.published_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('live_sessions')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  return NextResponse.json(data)
}

// DELETE /api/formateur/sessions/[id]
// Soft delete : set deleted_at = now()
// 409 si is_published=true (dépublier d'abord)
// 409 si des inscrits existent (annuler d'abord)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const redirect = await requireFormateur(request)
  if (redirect) return redirect

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: session } = await supabase
    .from('live_sessions')
    .select('id, formateur_user_id, is_published, deleted_at')
    .eq('id', params.id)
    .single()

  if (!session || session.deleted_at !== null) {
    return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  }

  const isAdmin = await isSuperAdmin(user.id)
  if (session.formateur_user_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  }

  if (session.is_published) {
    return NextResponse.json(
      { error: 'Dépubliez cette session avant de la supprimer' },
      { status: 409 }
    )
  }

  const { count } = await supabase
    .from('live_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', params.id)

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Des participants sont inscrits. Annulez la session avant de la supprimer.', registration_count: count },
      { status: 409 }
    )
  }

  const { error } = await supabase
    .from('live_sessions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
