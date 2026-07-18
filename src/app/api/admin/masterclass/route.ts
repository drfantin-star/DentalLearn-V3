import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { AdminProposeLiveSessionSchema } from '@/lib/schemas/live-session'

export const dynamic = 'force-dynamic'

// GET /api/admin/masterclass
// Vue superadmin : toutes les masterclass (live_sessions), enrichies du nom
// du formateur. Les `pending_review` remontent en premier.
export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!(await isSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  }

  const { data: sessions, error } = await supabase
    .from('live_sessions')
    .select('*, live_registrations(count)')
    .is('deleted_at', null)
    .order('starts_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const formateurIds = Array.from(new Set((sessions ?? []).map((s) => s.formateur_user_id as string)))
  const profileById = new Map<string, { first_name: string | null; last_name: string | null }>()

  if (formateurIds.length > 0) {
    const adminSupabase = createAdminClient()
    const { data: profiles } = await adminSupabase
      .from('user_profiles')
      .select('id, first_name, last_name')
      .in('id', formateurIds)
    for (const p of profiles ?? []) {
      profileById.set(p.id as string, {
        first_name: (p.first_name as string | null) ?? null,
        last_name: (p.last_name as string | null) ?? null,
      })
    }
  }

  const enriched = (sessions ?? []).map((s) => {
    const registration_count = (s.live_registrations as { count: number }[])?.[0]?.count ?? 0
    const { live_registrations: _, ...rest } = s
    const profile = profileById.get(s.formateur_user_id as string)
    return {
      ...rest,
      registration_count,
      formateur_name: profile
        ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || null
        : null,
    }
  })

  return NextResponse.json({ sessions: enriched })
}

// POST /api/admin/masterclass
// Superadmin crée une masterclass et la propose à un formateur (sens 2 du
// workflow). Toute la logique (garde rôle, insert, notif) vit dans le RPC.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!(await isSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const parsed = AdminProposeLiveSessionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const payload = parsed.data
  const { data, error } = await supabase.rpc('admin_propose_live_session', {
    p_formateur_user_id: payload.formateur_user_id,
    p_title: payload.title,
    p_description: payload.description ?? null,
    p_starts_at: payload.starts_at,
    p_duration_min: payload.duration_min,
    p_zoom_url: payload.zoom_url || null,
    p_zoom_password: payload.zoom_password ?? null,
    p_capacity: payload.capacity ?? null,
    p_formation_id: payload.formation_id ?? null,
    p_category: payload.category ?? null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data, { status: 201 })
}
