import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'

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
    const q = (searchParams.get('q') || '').trim()

    if (q.length < 2) {
      return NextResponse.json({ users: [] })
    }

    const adminSupabase = createAdminClient()
    const qLower = q.toLowerCase()

    const { data: authUsersData, error: authError } = await adminSupabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    })

    if (authError) {
      console.error('Erreur listUsers:', authError)
      return NextResponse.json({ error: 'Erreur recherche utilisateurs' }, { status: 500 })
    }

    const emailMatches = (authUsersData?.users || []).filter(u =>
      (u.email || '').toLowerCase().includes(qLower)
    )

    const { data: profileMatches, error: profileError } = await adminSupabase
      .from('user_profiles')
      .select('id, first_name, last_name')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      .limit(50)

    if (profileError) {
      console.error('Erreur user_profiles search:', profileError)
    }

    const matchedIds = new Set<string>()
    emailMatches.forEach(u => matchedIds.add(u.id))
    ;(profileMatches || []).forEach(p => matchedIds.add(p.id))

    if (matchedIds.size === 0) {
      return NextResponse.json({ users: [] })
    }

    const authUserMap = new Map(
      (authUsersData?.users || []).map(u => [u.id, u.email || ''])
    )

    const idsArray = Array.from(matchedIds)
    const { data: profilesData } = await adminSupabase
      .from('user_profiles')
      .select('id, first_name, last_name')
      .in('id', idsArray)

    const profilesMap = new Map(
      (profilesData || []).map(p => [p.id, p])
    )

    const users = idsArray
      .map(id => {
        const profile = profilesMap.get(id)
        return {
          id,
          email: authUserMap.get(id) || '',
          first_name: profile?.first_name || null,
          last_name: profile?.last_name || null
        }
      })
      .filter(u => u.email || u.first_name || u.last_name)
      .slice(0, 10)

    return NextResponse.json({ users })

  } catch (error) {
    console.error('Erreur API admin/users/search:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
