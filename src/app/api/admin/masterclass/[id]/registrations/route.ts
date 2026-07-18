import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'

export const dynamic = 'force-dynamic'

// GET /api/admin/masterclass/[id]/registrations
// Liste en lecture seule des inscrits à une masterclass (nom, email, date
// d'inscription, statut). Réservé super admin. Pas de gestion manuelle des
// inscriptions dans ce ticket (émargement/présence hors scope — attended /
// attended_duration_sec non alimentés).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!(await isSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  }

  const adminSupabase = createAdminClient()

  const { data: sessionRow, error: sessionError } = await adminSupabase
    .from('live_sessions')
    .select('id, title, capacity')
    .eq('id', id)
    .single()

  if (sessionError || !sessionRow) {
    return NextResponse.json({ error: 'Masterclass introuvable' }, { status: 404 })
  }

  const { data: registrations, error } = await adminSupabase
    .from('live_registrations')
    .select('id, user_id, registered_at, cancelled_at')
    .eq('session_id', id)
    .order('registered_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const userIds = Array.from(new Set((registrations ?? []).map((r) => r.user_id as string)))

  const profileById = new Map<string, { first_name: string | null; last_name: string | null }>()
  if (userIds.length > 0) {
    const { data: profiles } = await adminSupabase
      .from('user_profiles')
      .select('id, first_name, last_name')
      .in('id', userIds)
    for (const p of profiles ?? []) {
      profileById.set(p.id as string, {
        first_name: (p.first_name as string | null) ?? null,
        last_name: (p.last_name as string | null) ?? null,
      })
    }
  }

  const emailById = new Map<string, string | null>()
  await Promise.all(
    userIds.map(async (uid) => {
      try {
        const { data, error: userError } = await adminSupabase.auth.admin.getUserById(uid)
        emailById.set(uid, userError || !data?.user ? null : data.user.email ?? null)
      } catch {
        emailById.set(uid, null)
      }
    })
  )

  const enriched = (registrations ?? []).map((r) => {
    const profile = profileById.get(r.user_id as string)
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || null
    return {
      id: r.id,
      name,
      email: emailById.get(r.user_id as string) ?? null,
      registered_at: r.registered_at,
      cancelled_at: r.cancelled_at,
    }
  })

  const activeCount = enriched.filter((r) => !r.cancelled_at).length

  return NextResponse.json({
    session: { id: sessionRow.id, title: sessionRow.title, capacity: sessionRow.capacity },
    registrations: enriched,
    registration_count: activeCount,
  })
}
