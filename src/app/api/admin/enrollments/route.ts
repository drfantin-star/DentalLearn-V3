import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'drfantin@gmail.com'

// GET: Lister toutes les inscriptions avec détails utilisateurs
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const adminSupabase = createAdminClient()

    // Charger toutes les inscriptions
    const { data: enrollmentsData, error: enrollmentsError } = await adminSupabase
      .from('user_formations')
      .select(`
        id,
        user_id,
        formation_id,
        started_at,
        is_active,
        access_type
      `)
      .order('started_at', { ascending: false })

    if (enrollmentsError) {
      console.error('Erreur chargement inscriptions:', enrollmentsError)
      return NextResponse.json({ error: 'Erreur chargement inscriptions' }, { status: 500 })
    }

    if (!enrollmentsData || enrollmentsData.length === 0) {
      return NextResponse.json({ enrollments: [] })
    }

    // Récupérer les IDs uniques
    const userIds = Array.from(new Set(enrollmentsData.map(e => e.user_id)))
    const formationIds = Array.from(new Set(enrollmentsData.map(e => e.formation_id)))
    // Charger les profils utilisateurs
    const { data: profilesData } = await adminSupabase
      .from('user_profiles')
      .select('id, first_name, last_name')
      .in('id', userIds)

    // Charger les formations
    const { data: formationsData } = await adminSupabase
      .from('formations')
      .select('id, title, access_type')
      .in('id', formationIds)

    // Charger les emails depuis auth.users
    const { data: authUsersData } = await adminSupabase.auth.admin.listUsers()
    const authUsersMap = new Map(
      authUsersData?.users?.map(u => [u.id, u.email]) || []
    )

    // Mapper les données enrichies
    const enrichedEnrollments = enrollmentsData.map(enrollment => {
      const profile = profilesData?.find(p => p.id === enrollment.user_id)
      const formation = formationsData?.find(f => f.id === enrollment.formation_id)
      const userEmail = authUsersMap.get(enrollment.user_id) || ''

      // Calculer l'accès effectif: user override > formation default > 'demo'
      const effectiveAccess = enrollment.access_type || formation?.access_type || 'demo'

      return {
        id: enrollment.id,
        user_id: enrollment.user_id,
        formation_id: enrollment.formation_id,
        started_at: enrollment.started_at,
        is_active: enrollment.is_active,
        access_type: effectiveAccess,
        access_type_override: enrollment.access_type,
        user_profile: profile ? {
          first_name: profile.first_name,
          last_name: profile.last_name
        } : null,
        user_email: userEmail,
        formation: formation ? {
          id: formation.id,
          title: formation.title,
          access_type: formation.access_type || 'demo'
        } : null
      }
    })

    return NextResponse.json({ enrollments: enrichedEnrollments })

  } catch (error) {
    console.error('Erreur API admin/enrollments:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH: Mettre à jour le type d'accès d'une inscription
export async function PATCH(request: Request) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { enrollmentId, accessType } = await request.json()

    if (!enrollmentId || !accessType) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    if (!['demo', 'full'].includes(accessType)) {
      return NextResponse.json({ error: 'Type d\'accès invalide' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    const { error } = await adminSupabase
      .from('user_formations')
      .update({ access_type: accessType })
      .eq('id', enrollmentId)

    if (error) {
      console.error('Erreur mise à jour:', error)
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Erreur API admin/enrollments PATCH:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
