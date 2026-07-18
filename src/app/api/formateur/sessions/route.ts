import { NextRequest, NextResponse } from 'next/server'
import { requireFormateur } from '@/middleware'
import { createClient } from '@/lib/supabase/server'
import { LiveSessionSchema } from '@/lib/schemas/live-session'
import { computeSessionStatus } from '@/lib/utils/session-status'

export const dynamic = 'force-dynamic'

// GET /api/formateur/sessions
// Liste les sessions du formateur connecté, enrichies du statut calculé et du nombre d'inscrits.
// Retourne { upcoming: [], past: [] }
export async function GET(request: NextRequest) {
  const redirect = await requireFormateur(request)
  if (redirect) return redirect

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: sessions, error } = await supabase
    .from('live_sessions')
    .select('*, live_registrations(count)')
    .eq('formateur_user_id', user.id)
    .is('deleted_at', null)
    .order('starts_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  const enriched = (sessions ?? []).map((s) => {
    const registration_count = (s.live_registrations as { count: number }[])?.[0]?.count ?? 0
    const { live_registrations: _, ...session } = s
    return {
      ...session,
      registration_count,
      computed_status: computeSessionStatus(session),
    }
  })

  const now = new Date().toISOString()
  const upcoming = enriched.filter((s) => {
    const endTime = new Date(s.starts_at).getTime() + s.duration_min * 60_000
    return endTime > Date.now()
  })
  const past = enriched.filter((s) => {
    const endTime = new Date(s.starts_at).getTime() + s.duration_min * 60_000
    return endTime <= Date.now()
  })

  // past trié du plus récent au plus ancien
  past.sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())

  return NextResponse.json({ upcoming, past })
}

// POST /api/formateur/sessions
// Crée une nouvelle session masterclass.
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

  const parsed = LiveSessionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const payload = parsed.data
  const { data, error } = await supabase
    .from('live_sessions')
    .insert({
      ...payload,
      formateur_user_id: user.id,
      status: 'scheduled',
      zoom_url: payload.zoom_url || null,
      created_by_role: 'formateur',
      review_status: 'draft',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
