// Types et constantes de présentation de la Bibliothèque de ressources.
// Les DONNÉES vivent désormais dans Supabase (table public.bibliotheque_ressources) ;
// ce module ne contient plus que le contrat de type + les constantes visuelles
// partagées par BibliothequeView, BibliothequeBanner et l'éditeur admin.

export type AxeId = 1 | 3 | 4

// Ressource telle que consommée par les pages publiques (vue read-only).
export interface RessourceBibliotheque {
  id: string
  titre: string
  source: string // ex. "ADF", "SFCO", "HAS", "INRS", "DentalLearn"
  description?: string // 1 ligne max
  type: 'external' | 'internal'
  url: string // external : URL officielle ; internal : PDF public Supabase Storage
  categorie?: string // pour regrouper (ex. "Consentements")
}

// Ligne brute de la table (utilisée côté admin pour l'édition complète).
export interface BibliothequeRessourceRow {
  id: string
  axe: AxeId
  titre: string
  source: string
  description: string | null
  type: 'internal' | 'external'
  url: string
  storage_path: string | null
  categorie: string | null
  ordre: number
  created_at: string
  updated_at: string
}

// Dégradés d'accent par axe — alignés sur les <header> des pages d'axe
// (cf. /formation, /patient, /sante) pour une cohérence visuelle directe.
// Stops assombris par rapport aux couleurs de charte brutes pour adoucir
// le contraste sur fond sombre (#0F0F0F) sans changer la teinte.
export const AXE_GRADIENTS: Record<AxeId, { from: string; to: string }> = {
  1: { from: '#5B21B6', to: '#7C3AED' }, // Pratiques cliniques (violet-800 → violet-600)
  3: { from: '#9A3412', to: '#C2410C' }, // Relation patient (orange-900 → orange-700)
  4: { from: '#9D174D', to: '#7C3AED' }, // Santé praticien (pink-900 → violet-600)
}

// Sous-titres par défaut du bandeau, selon l'axe.
export const BIBLIOTHEQUE_DEFAULT_SUBTITLES: Record<AxeId, string> = {
  1: 'Documents et références pour vos pratiques cliniques',
  3: "Documents d'information et consentements à remettre à vos patients",
  4: 'Ressources pour votre santé et votre bien-être au travail',
}

// Libellés courts d'axe (onglets admin, sélecteurs).
export const AXE_LABELS: Record<AxeId, string> = {
  1: 'Axe 1 · Formation',
  3: 'Axe 3 · Patient',
  4: 'Axe 4 · Santé',
}
