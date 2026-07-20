import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'

export const dynamic = 'force-dynamic'

/**
 * Recherche de candidats à la promotion formateur.
 *
 * Un seul champ → match email OR prénom OR nom, insensible casse + accents,
 * ILIKE %terme%. La recherche vit dans la RPC SECURITY DEFINER
 * `search_formateur_candidates` (seul moyen d'unifier auth.users.email et
 * user_profiles.first_name/last_name en une requête indexée). La RPC garde
 * elle-même `is_super_admin(auth.uid())` ; on double la garde ici pour
 * couper au plus tôt.
 *
 * Déclenchement >= 2 caractères (le debounce est côté client), 20 résultats.
 */
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
    const q = (searchParams.get('q') ?? '').trim()

    if (q.length < 2) {
      return NextResponse.json({ users: [] })
    }

    // La RPC est appelée avec le client session (auth.uid() résolu) pour que
    // la garde is_super_admin interne s'applique au bon utilisateur.
    const { data, error } = await supabase.rpc('search_formateur_candidates', {
      p_query: q,
    })

    if (error) {
      console.error('Erreur RPC search_formateur_candidates:', error)
      return NextResponse.json({ error: 'Erreur de recherche' }, { status: 500 })
    }

    return NextResponse.json({ users: data ?? [] })
  } catch (error) {
    console.error('Erreur API admin/formateurs/search GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
