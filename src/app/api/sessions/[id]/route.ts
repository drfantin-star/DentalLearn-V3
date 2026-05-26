import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/sessions/[id]
// Retourne les détails d'une session publiée + l'état d'inscription de l'user connecté.
// zoom_url et zoom_password sont masqués (null) si l'user n'est PAS inscrit.
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: session } = await supabase
    .from('live_sessions')
    .select('*, live_registrations(count)')
    .eq('id', params.id)
    .single()

  if (!session || session.deleted_at !== null) {
    return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  }

  if (!session.is_published) {
    return NextResponse.json({ error: 'Session non disponible' }, { status: 404 })
  }

  const registration_count = (session.live_registrations as { count: number }[])?.[0]?.count ?? 0

  const { live_registrations: _, ...sessionData } = session

  // Vérifier si l'user est inscrit
  const { data: registration } = await supabase
    .from('live_registrations')
    .select('id')
    .eq('session_id', params.id)
    .eq('user_id', user.id)
    .single()

  const isRegistered = registration !== null

  // zoom_url et zoom_password masqués pour les non-inscrits
  const safeSession = {
    ...sessionData,
    registration_count,
    zoom_url: isRegistered ? sessionData.zoom_url : null,
    zoom_password: isRegistered ? sessionData.zoom_password : null,
  }

  return NextResponse.json({
    session: safeSession,
    user_registration_id: registration?.id ?? null,
  })
}
