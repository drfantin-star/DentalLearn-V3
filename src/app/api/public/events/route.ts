import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/public/events
// Route publique (sans auth) — retourne les events publiés, non-supprimés, à venir
// Params : formateurUserId?, formationId?
// Max 5 résultats, tri ASC starts_at
// La RLS SELECT appliquée avec auth.uid()=null expose uniquement
// is_published=true AND deleted_at IS NULL
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const formateurUserId = searchParams.get('formateurUserId')
  const formationId = searchParams.get('formationId')

  if (!formateurUserId && !formationId) {
    return NextResponse.json([])
  }

  const supabase = await createClient()

  let query = supabase
    .from('live_events')
    .select('id, title, location_city, starts_at, ends_at, external_registration_url')
    .eq('is_published', true)
    .is('deleted_at', null)
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

  if (error) {
    return NextResponse.json([], { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
