import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EvenementItemData } from '@/types/evenements'

export const dynamic = 'force-dynamic'

type EventRow = { id: string; title: string; starts_at: string; formateur_user_id: string }
type ProfileRow = { user_id: string; display_name: string | null }

const ALLOWED_TYPES = new Set(['all', 'presentiel', 'virtuel'])

export async function GET(request: NextRequest) {
  const supabase = createClient()
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
          .select('id, title, starts_at, formateur_user_id')
          .eq('is_published', true)
          .is('deleted_at', null)
          .gte('starts_at', now)
          .order('starts_at', { ascending: true })
          .limit(limit)
      : Promise.resolve({ data: [], error: null }),
    type !== 'presentiel'
      ? supabase
          .from('live_sessions')
          .select('id, title, starts_at, formateur_user_id')
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

  const allUserIds = [...new Set(
    [...events, ...sessions].map((e) => e.formateur_user_id).filter(Boolean)
  )]

  const profileMap: Record<string, string | null> = {}
  if (allUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from('formateur_profiles')
      .select('user_id, display_name')
      .in('user_id', allUserIds)
    for (const p of (profiles ?? []) as ProfileRow[]) {
      profileMap[p.user_id] = p.display_name ?? null
    }
  }

  const merged: EvenementItemData[] = [
    ...events.map((e) => ({
      id: e.id,
      type: 'presentiel' as const,
      title: e.title,
      starts_at: e.starts_at,
      formateur_display_name: profileMap[e.formateur_user_id] ?? null,
    })),
    ...sessions.map((s) => ({
      id: s.id,
      type: 'virtuel' as const,
      title: s.title,
      starts_at: s.starts_at,
      formateur_display_name: profileMap[s.formateur_user_id] ?? null,
    })),
  ]

  merged.sort((a, b) => a.starts_at.localeCompare(b.starts_at))

  return NextResponse.json(merged.slice(0, limit))
}
