import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================================
// GET /api/admin/news/taxonomy?type=specialite|theme|niveau_preuve
//
// Liste les slugs + libellés FR des entrées news_taxonomy actives d'un type
// donné. Alimente les <TaxonomyPicker> côté UI (T12-B + T12-C).
//
// Auth : isSuperAdmin() (cohérence /api/admin/news/*).
//
// Pourquoi pas resolveTaxonomyLabels() ici : ce helper résout slug → label
// pour une liste de slugs *connus*. Ici on a besoin du listing complet par
// type, qui est une query différente. Pas de cache applicatif (30 lignes,
// query <10ms, fréquence d'appel ~1 par ouverture de picker).
//
// Réponse : { items: Array<{ slug: string, label: string }> } trié par label.
// ============================================================================

const ALLOWED_TYPES = ['specialite', 'theme', 'niveau_preuve'] as const
type TaxonomyType = (typeof ALLOWED_TYPES)[number]

function isTaxonomyType(value: string): value is TaxonomyType {
  return (ALLOWED_TYPES as readonly string[]).includes(value)
}

export async function GET(request: Request) {
  try {
    // ----- 1. Auth -----
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    // ----- 2. Validation paramètre type -----
    const { searchParams } = new URL(request.url)
    const rawType = searchParams.get('type')

    if (!rawType) {
      return NextResponse.json(
        { error: 'Paramètre `type` requis', allowed_types: ALLOWED_TYPES },
        { status: 400 },
      )
    }
    if (!isTaxonomyType(rawType)) {
      return NextResponse.json(
        {
          error: `Type invalide : "${rawType}". Valeurs autorisées : ${ALLOWED_TYPES.join(', ')}`,
          allowed_types: ALLOWED_TYPES,
        },
        { status: 400 },
      )
    }

    // ----- 3. Query news_taxonomy active du type demandé -----
    const adminSupabase = createAdminClient()
    const { data, error } = await adminSupabase
      .from('news_taxonomy')
      .select('slug, label')
      .eq('type', rawType)
      .eq('active', true)
      .order('label', { ascending: true })

    if (error) {
      console.error('Erreur lecture news_taxonomy:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const items = (data ?? []).map((row: { slug: string; label: string }) => ({
      slug: row.slug,
      label: row.label,
    }))

    return NextResponse.json({ items })

  } catch (error) {
    console.error('Erreur API admin/news/taxonomy GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
