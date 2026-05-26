import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Sprint 2 T2 — Promotion d'un user existant au rôle `formateur`.
 *
 * Choix de design (D2-T2-01 documenté dans la PR) : on ne crée PAS de
 * `formateur_profiles` ici. Le profil sera créé à la volée la première
 * fois que le formateur visitera `/formateur/profil` en T6
 * (INSERT … ON CONFLICT DO NOTHING).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const userId = body && typeof body === 'object' && typeof body.user_id === 'string'
      ? body.user_id.trim()
      : ''

    if (!UUID_RE.test(userId)) {
      return NextResponse.json({ error: 'user_id invalide' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // Vérifie que l'auth.users existe (sécurité défense en profondeur).
    const { data: authCheck, error: authError } =
      await adminSupabase.auth.admin.getUserById(userId)
    if (authError || !authCheck?.user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }

    // INSERT user_roles avec ON CONFLICT DO NOTHING via upsert idempotent.
    // La contrainte UNIQUE(user_id, role) — si elle existe — empêche le doublon ;
    // sinon, le code 23505 sera levé et on le considère idempotent.
    const { error: insertError } = await adminSupabase
      .from('user_roles')
      .insert({ user_id: userId, role: 'formateur' })

    if (insertError) {
      // 23505 = unique_violation = déjà formateur → idempotent OK.
      if (insertError.code !== '23505') {
        console.error('Erreur INSERT user_roles:', insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, user_id: userId, role: 'formateur' })
  } catch (error) {
    console.error('Erreur API admin/formateurs/promote POST:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
