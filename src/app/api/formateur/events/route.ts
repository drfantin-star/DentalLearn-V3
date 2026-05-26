import { NextRequest, NextResponse } from 'next/server'
import { requireFormateur } from '@/middleware'
import { createClient } from '@/lib/supabase/server'
import { LiveEventSchema } from '@/lib/schemas/live-event'

export const dynamic = 'force-dynamic'

// GET /api/formateur/events
// Retourne les events du formateur connecté (deleted_at IS NULL), groupés upcoming/past
export async function GET(request: NextRequest) {
  const redirect = await requireFormateur(request)
  if (redirect) return redirect

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('live_events')
    .select(
      'id, title, description, location_city, location_venue, starts_at, ends_at, external_registration_url, capacity, is_published, formation_id, created_at, updated_at'
    )
    .eq('formateur_user_id', user.id)
    .is('deleted_at', null)
    .order('starts_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  const events: { starts_at: string }[] = data ?? []
  const now = new Date().toISOString()

  return NextResponse.json({
    upcoming: events.filter((e) => e.starts_at >= now),
    past: events.filter((e) => e.starts_at < now),
  })
}

// POST /api/formateur/events
// Crée un nouvel event
export async function POST(request: NextRequest) {
  const redirect = await requireFormateur(request)
  if (redirect) return redirect

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const parsed = LiveEventSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const payload = parsed.data

  const { data, error } = await supabase
    .from('live_events')
    .insert({
      ...payload,
      formateur_user_id: user.id,
      external_registration_url: payload.external_registration_url || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
