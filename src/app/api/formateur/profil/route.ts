import { NextRequest, NextResponse } from 'next/server'
import { requireFormateur } from '@/middleware'
import { createClient } from '@/lib/supabase/server'
import { FormateurProfilSchema } from '@/lib/schemas/formateur-profil'

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
export async function GET(request: NextRequest) {
  const redirect = await requireFormateur(request)
  if (redirect) return redirect

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('formateur_profiles')
    .select(
      'id, user_id, slug, display_name, bio_long, expertise_tags, annees_experience, ville, cabinet_nom, linkedin_url, instagram_url, photo_pro_url, is_published, published_at'
    )
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })

  return NextResponse.json(data ?? { ...EMPTY_PROFILE, user_id: user.id })
}

// PATCH /api/formateur/profil
// Upsert du profil formateur (INSERT ON CONFLICT user_id DO UPDATE).
// N'accepte pas avatar_url — géré par /api/formateur/profil/avatar.
export async function PATCH(request: NextRequest) {
  const redirect = await requireFormateur(request)
  if (redirect) return redirect

  const supabase = createClient()
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

  const payload = parsed.data

  // Normaliser les URL vides → null
  const normalised = {
    ...payload,
    linkedin_url: payload.linkedin_url || null,
    instagram_url: payload.instagram_url || null,
  }

  // Récupérer le profil existant pour savoir si published_at doit être défini
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

  const { data, error } = await supabase
    .from('formateur_profiles')
    .upsert(upsertPayload, { onConflict: 'user_id' })
    .select(
      'id, user_id, slug, display_name, bio_long, expertise_tags, annees_experience, ville, cabinet_nom, linkedin_url, instagram_url, photo_pro_url, is_published, published_at'
    )
    .single()

  if (error) return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })

  return NextResponse.json(data)
}
