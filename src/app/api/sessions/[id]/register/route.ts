import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeSessionStatus } from '@/lib/utils/session-status'

export const dynamic = 'force-dynamic'

// POST /api/sessions/[id]/register
// Inscrit l'utilisateur connecté à la session.
// Vérifie : session publiée, pas annulée/terminée, capacité non atteinte, pas déjà inscrit.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: session } = await supabase
    .from('live_sessions')
    .select('id, is_published, status, starts_at, duration_min, capacity, deleted_at')
    .eq('id', id)
    .single()

  if (!session || session.deleted_at !== null) {
    return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  }

  if (!session.is_published) {
    return NextResponse.json({ error: 'Session non disponible' }, { status: 404 })
  }

  const computedStatus = computeSessionStatus(session)

  if (computedStatus === 'cancelled') {
    return NextResponse.json({ error: 'Session annulée' }, { status: 409 })
  }

  if (computedStatus === 'ended') {
    return NextResponse.json({ error: 'Session terminée' }, { status: 409 })
  }

  // Vérifier doublon
  const { data: existing } = await supabase
    .from('live_registrations')
    .select('id')
    .eq('session_id', id)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Déjà inscrit à cette session' }, { status: 409 })
  }

  // Vérifier capacité
  if (session.capacity != null) {
    const { count } = await supabase
      .from('live_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', id)

    if ((count ?? 0) >= session.capacity) {
      return NextResponse.json({ error: 'Session complète' }, { status: 409 })
    }
  }

  const { data: registration, error } = await supabase
    .from('live_registrations')
    .insert({ session_id: id, user_id: user.id })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, registration_id: registration.id }, { status: 201 })
}

// DELETE /api/sessions/[id]/register
// Désinscrit l'utilisateur connecté.
// 409 si la session est live ou terminée.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: session } = await supabase
    .from('live_sessions')
    .select('id, status, starts_at, duration_min, deleted_at')
    .eq('id', id)
    .single()

  if (!session || session.deleted_at !== null) {
    return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  }

  const computedStatus = computeSessionStatus(session)

  if (computedStatus === 'live' || computedStatus === 'ended') {
    return NextResponse.json(
      { error: 'Désinscription impossible : la session est en cours ou terminée' },
      { status: 409 }
    )
  }

  const { data: registration } = await supabase
    .from('live_registrations')
    .select('id')
    .eq('session_id', id)
    .eq('user_id', user.id)
    .single()

  if (!registration) {
    return NextResponse.json({ error: 'Inscription introuvable' }, { status: 404 })
  }

  const { error } = await supabase
    .from('live_registrations')
    .delete()
    .eq('id', registration.id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
