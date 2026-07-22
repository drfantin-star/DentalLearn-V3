import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'

export const dynamic = 'force-dynamic'

// Garde super_admin partagee. La lecture des emails passe par le service_role
// (auth.users), jamais depuis le navigateur.
async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return { blocked: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  }
  if (!(await isSuperAdmin(session.user.id))) {
    return { blocked: NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 }) }
  }
  return { blocked: null as null }
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

// GET : liste des suppressions en attente (email, date de demande, date de purge).
export async function GET() {
  try {
    const { blocked } = await requireSuperAdmin()
    if (blocked) return blocked

    const admin = createAdminClient()
    const { data: profiles, error } = await admin
      .from('user_profiles')
      .select('id, deletion_requested_at')
      .not('deletion_requested_at', 'is', null)
      .order('deletion_requested_at', { ascending: true })

    if (error) throw error

    // Emails resolus par id (jeu restreint : uniquement les demandes en cours).
    const deletions = await Promise.all(
      (profiles || []).map(async (p) => {
        const { data: u } = await admin.auth.admin.getUserById(p.id)
        const requestedAt = p.deletion_requested_at as string
        return {
          user_id: p.id,
          email: u?.user?.email || '',
          requested_at: requestedAt,
          purge_at: new Date(new Date(requestedAt).getTime() + THIRTY_DAYS_MS).toISOString(),
        }
      })
    )

    return NextResponse.json({ count: deletions.length, deletions })
  } catch (err) {
    console.error('admin/deletions GET error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST { user_id } : annule une demande de suppression (deletion_requested_at -> NULL).
export async function POST(request: Request) {
  try {
    const { blocked } = await requireSuperAdmin()
    if (blocked) return blocked

    const { user_id } = await request.json().catch(() => ({}))
    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json({ error: 'user_id requis' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('user_profiles')
      .update({ deletion_requested_at: null })
      .eq('id', user_id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('admin/deletions POST error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
