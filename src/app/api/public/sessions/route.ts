import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/public/sessions
// Route publique — retourne les sessions publiées, non-supprimées, non-annulées, à venir.
// Params : formateurUserId?, formationId?
// Max 5 résultats, tri ASC starts_at.
// La RLS live_sessions SELECT expose is_published=true AND deleted_at IS NULL pour auth.uid()=null.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const formateurUserId = searchParams.get('formateurUserId')
  const formationId = searchParams.get('formationId')

  if (!formateurUserId && !formationId) {
    return NextResponse.json([])
  }

  const supabase = await createClient()

  let query = supabase
    .from('live_sessions')
    .select('id, title, starts_at, duration_min, capacity, category, live_registrations(count)')
    .eq('is_published', true)
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(5)

  if (formateurUserId) {
    query = query.eq('formateur_user_id', formateurUserId)
  }
  if (formationId) {
    query = query.eq('formation_id', formationId)
  }

  const { data, error } = await query

  if (error) return NextResponse.json([], { status: 500 })

  const sessions = (data ?? []).map((s) => {
    const registration_count =
      (s.live_registrations as { count: number }[])?.[0]?.count ?? 0
    const { live_registrations: _, ...session } = s
    const places_restantes =
      session.capacity != null ? Math.max(0, session.capacity - registration_count) : null
    return { ...session, registration_count, places_restantes }
  })

  return NextResponse.json(sessions)
}
