import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { ALLOWED_FORMATION_CATEGORIES } from '@/lib/constants/news'

const ALLOWED_FORMATION_CATEGORIES_SET: Set<string> = new Set(ALLOWED_FORMATION_CATEGORIES)

// GET: Détail d'une synthèse + article brut lié + nombre de questions associées
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const adminSupabase = createAdminClient()

    const { data: synthesis, error: synthError } = await adminSupabase
      .from('news_syntheses')
      .select('*')
      .eq('id', id)
      .single()

    if (synthError) {
      const status = synthError.code === 'PGRST116' ? 404 : 500
      console.error('Erreur chargement synthèse:', synthError)
      return NextResponse.json({ error: synthError.message }, { status })
    }

    let raw: {
      title: string
      url: string | null
      doi: string | null
      journal: string | null
      published_at: string | null
      abstract: string | null
    } | null = null

    if (synthesis.raw_id) {
      const { data: rawData, error: rawError } = await adminSupabase
        .from('news_raw')
        .select('title, url, doi, journal, published_at, abstract')
        .eq('id', synthesis.raw_id)
        .single()

      if (rawError && rawError.code !== 'PGRST116') {
        console.error('Erreur chargement news_raw lié:', rawError)
        return NextResponse.json({ error: rawError.message }, { status: 500 })
      }

      raw = rawData ?? null
    }

    const { count: questionsCount, error: questionsError } = await adminSupabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('news_synthesis_id', id)

    if (questionsError) {
      console.error('Erreur comptage questions liées:', questionsError)
      return NextResponse.json({ error: questionsError.message }, { status: 500 })
    }

    return NextResponse.json({
      synthesis,
      raw,
      questions_count: questionsCount ?? 0,
    })

  } catch (error) {
    console.error('Erreur API admin/news/syntheses/[id] GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ============================================================================
// PATCH : édition admin d'une synthèse (POC-T12 — extension du périmètre
// historique formation_category_match seul vers tous les champs éditables).
//
// Périmètre V1 (Q-T12-2 = (a)+(b)+category_editorial) :
//   - Bloc texte : summary_fr (≥50), method, key_figures, evidence_level,
//     clinical_impact, caveats, display_title (≤70, rejet 400 strict)
//   - Bloc taxonomy : specialite, themes (array vide légitime — cf. D-PF-2),
//     niveau_preuve
//   - Catégorie éditoriale : reglementaire/scientifique/pratique/humour
//   - Existant T8 préservé : formation_category_match (régression test x)
//
// Tous les champs sont .optional() → PATCH partiel. Le caller existant
// /admin/news/[id]/page.tsx qui envoie { formation_category_match } seul
// continue à fonctionner exactement comme avant T12. Pas de .strict() sur
// le schéma racine : keys inconnues ignorées (rétro-compat callers futurs).
//
// Audit soft Q-T12-6 = (b) : last_edited_at + last_edited_by mis à jour à
// chaque PATCH réussi côté API (pas trigger BDD).
//
// Auth : isSuperAdmin() — invariant /api/admin/news/* (Q-T12-5 satisfaite).
// ============================================================================

const PatchSynthesisInput = z.object({
  // Bloc texte
  summary_fr: z
    .string()
    .min(50, 'summary_fr doit contenir au moins 50 caractères')
    .optional(),
  method: z.string().nullable().optional(),
  key_figures: z
    .array(z.string().min(1, 'Un chiffre clé ne peut pas être vide'))
    .optional(),
  evidence_level: z.string().nullable().optional(),
  clinical_impact: z.string().nullable().optional(),
  caveats: z.string().nullable().optional(),
  display_title: z.string().max(70, '70 caractères max').optional(),

  // Bloc taxonomy (validation slug ∈ news_taxonomy active type-aware infra)
  specialite: z.string().nullable().optional(),
  // PF3 + D-PF-2 : taxonomy themes restrictive (8 slugs au 13/05/2026),
  // array vide légitime quand aucun ne matche le sujet de la synthèse.
  themes: z.array(z.string()).optional(),
  niveau_preuve: z.string().nullable().optional(),

  // Catégorie éditoriale
  category_editorial: z
    .enum(['reglementaire', 'scientifique', 'pratique', 'humour'])
    .nullable()
    .optional(),

  // Existant T8 (régression préservée — caller /admin/news/[id]/page.tsx)
  formation_category_match: z.string().nullable().optional(),
})

type PatchInput = z.infer<typeof PatchSynthesisInput>
type TaxonomyType = 'specialite' | 'theme' | 'niveau_preuve'

const EDITABLE_KEYS = [
  'summary_fr',
  'method',
  'key_figures',
  'evidence_level',
  'clinical_impact',
  'caveats',
  'display_title',
  'specialite',
  'themes',
  'niveau_preuve',
  'category_editorial',
  'formation_category_match',
] as const satisfies readonly (keyof PatchInput)[]

type EditableKey = (typeof EDITABLE_KEYS)[number]

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // ----- 1. Auth (invariant Q-T12-5) -----
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    // ----- 2. Parse + Zod -----
    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
    }

    const parsed = PatchSynthesisInput.safeParse(rawBody)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      return NextResponse.json(
        {
          error: firstIssue?.message ?? 'Payload invalide',
          field: firstIssue?.path.join('.') || null,
        },
        { status: 400 },
      )
    }
    const input: PatchInput = parsed.data

    // ----- 3. Au moins un champ éditable fourni -----
    // Un PATCH vide (ou ne contenant que des keys inconnues ignorées par
    // Zod) ne doit pas toucher silencieusement last_edited_at/by.
    const providedKeys: EditableKey[] = EDITABLE_KEYS.filter(
      (k) => input[k] !== undefined,
    )
    if (providedKeys.length === 0) {
      return NextResponse.json(
        { error: 'Aucun champ éditable fourni' },
        { status: 400 },
      )
    }

    const adminSupabase = createAdminClient()

    // ----- 4. Validation formation_category_match (slug allow-list T8) -----
    if (
      input.formation_category_match !== undefined &&
      input.formation_category_match !== null
    ) {
      if (!ALLOWED_FORMATION_CATEGORIES_SET.has(input.formation_category_match)) {
        return NextResponse.json(
          {
            error: 'formation_category_match invalide (slug non autorisé)',
            field: 'formation_category_match',
          },
          { status: 400 },
        )
      }
    }

    // ----- 5. Validation slugs taxonomy (1 query batchée par type) -----
    type SlugCheck = { slug: string; type: TaxonomyType }
    const slugsToCheck: SlugCheck[] = []

    if (typeof input.specialite === 'string' && input.specialite.length > 0) {
      slugsToCheck.push({ slug: input.specialite, type: 'specialite' })
    }
    if (typeof input.niveau_preuve === 'string' && input.niveau_preuve.length > 0) {
      slugsToCheck.push({ slug: input.niveau_preuve, type: 'niveau_preuve' })
    }
    if (input.themes && input.themes.length > 0) {
      for (const t of input.themes) {
        slugsToCheck.push({ slug: t, type: 'theme' })
      }
    }

    if (slugsToCheck.length > 0) {
      const uniqueSlugs = Array.from(new Set(slugsToCheck.map((s) => s.slug)))
      const { data: taxonomyRows, error: taxonomyError } = await adminSupabase
        .from('news_taxonomy')
        .select('slug, type')
        .in('slug', uniqueSlugs)
        .eq('active', true)

      if (taxonomyError) {
        console.error('Erreur validation taxonomy slugs:', taxonomyError)
        return NextResponse.json(
          { error: taxonomyError.message },
          { status: 500 },
        )
      }

      const validSet = new Set(
        (taxonomyRows ?? []).map(
          (r: { slug: string; type: string }) => `${r.slug}|${r.type}`,
        ),
      )
      const invalid = slugsToCheck.filter(
        (s) => !validSet.has(`${s.slug}|${s.type}`),
      )
      if (invalid.length > 0) {
        const details = invalid.map((s) => `${s.slug} (type=${s.type})`).join(', ')
        return NextResponse.json(
          {
            error: `Slug(s) taxonomy inactif(s) ou type incorrect : ${details}`,
            field: invalid[0].type,
            invalid_slugs: invalid,
          },
          { status: 400 },
        )
      }
    }

    // ----- 6. Construction de l'objet UPDATE (seuls les champs fournis) -----
    const updates: Record<string, unknown> = {}
    for (const k of providedKeys) {
      updates[k] = input[k]
    }

    // Audit soft Q-T12-6 = (b)
    updates.last_edited_at = new Date().toISOString()
    updates.last_edited_by = session.user.id

    // ----- 7. UPDATE BDD -----
    const { data, error } = await adminSupabase
      .from('news_syntheses')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      const status = error.code === 'PGRST116' ? 404 : 500
      console.error('Erreur mise à jour synthèse:', error)
      return NextResponse.json({ error: error.message }, { status })
    }

    return NextResponse.json({ success: true, synthesis: data })

  } catch (error) {
    console.error('Erreur API admin/news/syntheses/[id] PATCH:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
