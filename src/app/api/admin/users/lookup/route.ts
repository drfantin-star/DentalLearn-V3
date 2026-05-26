import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Cf. dette D-S1-T5-01 (héritée Sprint 1) : `auth.admin.listUsers()` paginé,
// pas d'API getUserByEmail. Acceptable tant que la base reste modeste.
async function findUserByEmail(adminSupabase: any, email: string) {
  const target = email.toLowerCase()
  const PER_PAGE = 200
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await adminSupabase.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    })
    if (error || !data) return null
    const found = (data.users ?? []).find(
      (u: any) => (u.email ?? '').toLowerCase() === target
    )
    if (found) return found
    if ((data.users ?? []).length < PER_PAGE) return null
  }
  return null
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const email = (searchParams.get('email') ?? '').trim().toLowerCase()

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()
    const authUser = await findUserByEmail(adminSupabase, email)

    if (!authUser) {
      return NextResponse.json({ found: false })
    }

    const userId = authUser.id as string

    // user_profiles + flag is_formateur + nb formations rattachées (en parallèle).
    const [profileRes, formateurRes, instructorRes] = await Promise.all([
      adminSupabase
        .from('user_profiles')
        .select('first_name, last_name')
        .eq('id', userId)
        .maybeSingle(),
      adminSupabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role', 'formateur')
        .maybeSingle(),
      adminSupabase
        .from('formation_instructors')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ])

    const firstName = (profileRes.data?.first_name as string | null) ?? null
    const lastName = (profileRes.data?.last_name as string | null) ?? null
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || null

    return NextResponse.json({
      found: true,
      user: {
        id: userId,
        email: (authUser.email as string | null) ?? null,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        is_formateur: !!formateurRes.data,
        formations_count: instructorRes.count ?? 0,
      },
    })
  } catch (error) {
    console.error('Erreur API admin/users/lookup GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
