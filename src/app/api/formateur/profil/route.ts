import { NextRequest, NextResponse } from 'next/server'
import { requireFormateur } from '@/middleware'
import { createClient } from '@/lib/supabase/server'
import { FormateurProfilSchema } from '@/lib/schemas/formateur-profil'

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
}

export const dynamic = 'force-dynamic'

const EMPTY_PROFILE = {
  bio_long: null,
  expertise_tags: [],
  annees_experience: null,
  ville: null,
  cabinet_nom: null,
  linkedin_url: null,
  instagram_url: null,
  photo_pro_url: null,
  is_published: false,
  slug: null,
  display_name: null,
}

// GET /api/formateur/profil
// Retourne le profil complet du formateur connecté.
// Si aucun profil n'existe encore, retourne un objet vide avec les defaults.
// Le prénom/nom sont portés par user_profiles (source unique platform-wide,
// cf. /profil), pas dupliqués dans formateur_profiles.
export async function GET(request: NextRequest) {
  const redirect = await requireFormateur(request)
  if (redirect) return redirect

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const [{ data, error }, { data: userProfile }] = await Promise.all([
    supabase
      .from('formateur_profiles')
      .select(
        'id, user_id, slug, display_name, bio_long, expertise_tags, annees_experience, ville, cabinet_nom, linkedin_url, instagram_url, photo_pro_url, is_published, published_at'
      )
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.from('user_profiles').select('first_name, last_name').eq('id', user.id).maybeSingle(),
  ])

  if (error) return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })

  return NextResponse.json({
    ...(data ?? { ...EMPTY_PROFILE, user_id: user.id }),
    first_name: userProfile?.first_name ?? null,
    last_name: userProfile?.last_name ?? null,
  })
}

// PATCH /api/formateur/profil
// Upsert du profil formateur (INSERT ON CONFLICT user_id DO UPDATE).
// N'accepte pas avatar_url — géré par /api/formateur/profil/avatar.
export async function PATCH(request: NextRequest) {
  const redirect = await requireFormateur(request)
  if (redirect) return redirect

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const parsed = FormateurProfilSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { first_name, last_name, ...formateurPayload } = parsed.data

  // Normaliser les URL vides → null
  const normalised = {
    ...formateurPayload,
    linkedin_url: formateurPayload.linkedin_url || null,
    instagram_url: formateurPayload.instagram_url || null,
  }

  // Prénom/nom vivent dans user_profiles (source unique platform-wide, cf.
  // /profil) : upsert systématique, même pattern que handleSaveProfil côté
  // /profil (vide → null).
  const trimmedFirstName = (first_name ?? '').trim()
  const trimmedLastName = (last_name ?? '').trim()
  await supabase.from('user_profiles').upsert(
    {
      id: user.id,
      first_name: trimmedFirstName || null,
      last_name: trimmedLastName || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )
  const composedName = [trimmedFirstName, trimmedLastName].filter(Boolean).join(' ')

  // Récupérer le profil existant pour savoir si published_at doit être défini
  // et détecter un premier INSERT (slug/display_name auto-génération)
  const { data: existing } = await supabase
    .from('formateur_profiles')
    .select('published_at')
    .eq('user_id', user.id)
    .maybeSingle()

  const publishedAt =
    normalised.is_published && !existing?.published_at ? new Date().toISOString() : undefined

  const upsertPayload: Record<string, unknown> = {
    ...normalised,
    user_id: user.id,
    updated_at: new Date().toISOString(),
    ...(publishedAt ? { published_at: publishedAt } : {}),
  }

  if (!existing) {
    // Premier INSERT : injecter slug + display_name. Priorité au prénom/nom
    // tout juste saisis ; sinon repli sur l'ancien comportement (metadata
    // auth / local-part de l'email).
    const rawName = composedName || user.user_metadata?.full_name || user.email?.split('@')[0] || 'formateur'
    const displayName = String(rawName).slice(0, 120)
    const slug = slugify(displayName) + '-' + user.id.slice(0, 6)
    upsertPayload.display_name = displayName
    upsertPayload.slug = slug
  } else if (composedName) {
    // Migration douce (règle CLAUDE.md) : ne recalcule display_name que si
    // prénom ET nom sont renseignés — ne jamais écraser une valeur existante
    // avec du vide.
    upsertPayload.display_name = composedName.slice(0, 120)
  }

  const { data, error } = await supabase
    .from('formateur_profiles')
    .upsert(upsertPayload, { onConflict: 'user_id' })
    .select(
      'id, user_id, slug, display_name, bio_long, expertise_tags, annees_experience, ville, cabinet_nom, linkedin_url, instagram_url, photo_pro_url, is_published, published_at'
    )
    .single()

  if (error) return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })

  return NextResponse.json({ ...data, first_name: trimmedFirstName || null, last_name: trimmedLastName || null })
}
