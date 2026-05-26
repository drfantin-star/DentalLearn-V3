import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/formateurs/[slug]
// Retourne le profil public d'un formateur (is_published=true uniquement).
// La RLS formateur_profiles SELECT filtre déjà is_published=true pour les users non-owners.
// 404 si slug inconnu ou profil non publié.
export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('formateur_profiles')
    .select(
      'id, user_id, slug, display_name, bio_long, expertise_tags, annees_experience, ville, cabinet_nom, linkedin_url, instagram_url, photo_pro_url, is_published'
    )
    .eq('slug', params.slug)
    .eq('is_published', true)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  return NextResponse.json(data)
}
