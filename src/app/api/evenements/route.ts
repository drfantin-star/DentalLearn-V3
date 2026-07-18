import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { EvenementItemData } from '@/types/evenements'

export const dynamic = 'force-dynamic'

type EventRow = { id: string; title: string; starts_at: string; formateur_user_id: string; category: string | null }
type ProfileRow = { user_id: string; display_name: string | null; slug: string | null; photo_pro_url: string | null; is_published: boolean }

const ALLOWED_TYPES = new Set(['all', 'presentiel', 'virtuel'])

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const rawType = searchParams.get('type') ?? 'all'
  const type = ALLOWED_TYPES.has(rawType) ? rawType : 'all'
  const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10)
  const limit = isNaN(rawLimit) || rawLimit < 1 ? 20 : Math.min(rawLimit, 50)

  const now = new Date().toISOString()

  const [eventsResult, sessionsResult] = await Promise.all([
    type !== 'virtuel'
      ? supabase
          .from('live_events')
          .select('id, title, starts_at, formateur_user_id, category')
          .eq('is_published', true)
          .is('deleted_at', null)
          .gte('starts_at', now)
          .order('starts_at', { ascending: true })
          .limit(limit)
      : Promise.resolve({ data: [], error: null }),
    type !== 'presentiel'
      ? supabase
          .from('live_sessions')
          .select('id, title, starts_at, formateur_user_id, category')
          .eq('is_published', true)
          .is('deleted_at', null)
          .gte('starts_at', now)
          .neq('status', 'cancelled')
          .order('starts_at', { ascending: true })
          .limit(limit)
      : Promise.resolve({ data: [], error: null }),
  ])

  const events: EventRow[] = (eventsResult.data ?? []) as EventRow[]
  const sessions: EventRow[] = (sessionsResult.data ?? []) as EventRow[]

  const allUserIds = Array.from(new Set(
    [...events, ...sessions].map((e) => e.formateur_user_id).filter(Boolean)
  ))

  // Client admin (bypass RLS) : le nom du formateur doit s'afficher même si
  // son profil public n'est pas publié — seul le lien vers /formateurs/[slug]
  // est conditionné à is_published (décidé ici, pas par la RLS).
  const profileMap: Record<string, ProfileRow> = {}
  if (allUserIds.length > 0) {
    const adminSupabase = createAdminClient()
    const { data: profiles } = await adminSupabase
      .from('formateur_profiles')
      .select('user_id, display_name, slug, photo_pro_url, is_published')
      .in('user_id', allUserIds)
    for (const p of (profiles ?? []) as ProfileRow[]) {
      profileMap[p.user_id] = p
    }
  }

  function formateurFields(userId: string) {
    const profile = profileMap[userId]
    const published = profile?.is_published === true
    return {
      formateur_display_name: profile?.display_name ?? null,
      formateur_slug: published ? profile?.slug ?? null : null,
      formateur_photo_url: profile?.photo_pro_url ?? null,
    }
  }

  const merged: EvenementItemData[] = [
    ...events.map((e) => ({
      id: e.id,
      type: 'presentiel' as const,
      title: e.title,
      starts_at: e.starts_at,
      category: e.category,
      ...formateurFields(e.formateur_user_id),
    })),
    ...sessions.map((s) => ({
      id: s.id,
      type: 'virtuel' as const,
      title: s.title,
      starts_at: s.starts_at,
      category: s.category,
      ...formateurFields(s.formateur_user_id),
    })),
  ]

  merged.sort((a, b) => a.starts_at.localeCompare(b.starts_at))

  return NextResponse.json(merged.slice(0, limit))
}
