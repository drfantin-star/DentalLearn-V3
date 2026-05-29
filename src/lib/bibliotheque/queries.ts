import { createClient } from '@/lib/supabase/server'
import type { AxeId, RessourceBibliotheque } from './types'

// Lecture des ressources d'un axe depuis Supabase, triées par catégorie puis
// ordre (ASC) — l'ordre attendu par BibliothequeView (regroupement par
// catégorie en préservant l'ordre d'apparition). Server-only.
export async function getRessourcesByAxe(
  axe: AxeId,
): Promise<RessourceBibliotheque[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bibliotheque_ressources')
    .select('id, titre, source, description, type, url, categorie')
    .eq('axe', axe)
    .order('categorie', { ascending: true })
    .order('ordre', { ascending: true })

  if (error) {
    console.error('getRessourcesByAxe error:', error.message)
    return []
  }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    titre: r.titre as string,
    source: r.source as string,
    description: (r.description as string | null) ?? undefined,
    type: r.type as 'internal' | 'external',
    url: r.url as string,
    categorie: (r.categorie as string | null) ?? undefined,
  }))
}

// Nombre de ressources d'un axe (pour la pastille du BibliothequeBanner). Server-only.
export async function getRessourceCountByAxe(axe: AxeId): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('bibliotheque_ressources')
    .select('id', { count: 'exact', head: true })
    .eq('axe', axe)

  if (error) {
    console.error('getRessourceCountByAxe error:', error.message)
    return 0
  }
  return count ?? 0
}
