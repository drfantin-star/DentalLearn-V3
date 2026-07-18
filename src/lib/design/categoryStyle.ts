/**
 * SOURCE DE VÉRITÉ UNIQUE des couleurs de catégorie / thème / spécialité.
 *
 * Toute surface qui affiche une couleur de contenu (carte formation, carte
 * news, carte événement, chip d'intérêt, bibliothèque, quiz par thème) DOIT
 * lire ce fichier via `getCategoryStyle`. Les valeurs viennent de
 * `docs/PALETTE_COULEURS_CERTILY.md` §2-§5 — ne pas taper de hex ailleurs.
 *
 * Doctrine (charte §0, décision 2'B) : la couleur porte le THÈME, pas
 * l'axe — y compris pour les Axes 3 et 4 (abroge l'ancienne règle "un seul
 * dégradé par axe"). Les couleurs d'AXE (headers de page, radar CP,
 * bandeaux d'attestation, PDF) restent dans `src/lib/cp/axeColors.ts`.
 */

export interface CategoryStyle {
  from: string
  to: string
  /** Teinte solide (stop sombre du dégradé), pour badges/pastilles compacts. */
  badge: string
  label: string
}

/** Neutre système — fallback pour un slug inconnu. Jamais #2D1B96/#00D1C1. */
export const NEUTRAL_STYLE: CategoryStyle = {
  from: '#6B7280',
  to: '#4B5563',
  badge: '#6B7280',
  label: 'Autre',
}

/**
 * Alias formation → slug news canonique (charte §2, décision 1A).
 * Un alias résout vers la même entrée que sa cible : même couleur garantie
 * par construction, jamais par recopie de valeur.
 */
const CATEGORY_ALIASES: Record<string, string> = {
  restauratrice: 'dent-resto',
  implant: 'implanto',
  chirurgie: 'chir-orale',
  endodontie: 'endo',
  parodontologie: 'paro',
  prothese: 'proth',
}

/**
 * Les 12 slugs de `news.specialite` (charte §2). Exporté pour que les
 * consommateurs news (quiz, cover, SVG) sachent distinguer "spécialité
 * connue" (→ getCategoryStyle) de "spécialité absente" (→ leur propre
 * fallback news, différent du Neutre générique).
 */
export const NEWS_SPECIALITE_SLUGS = [
  'odf',
  'implanto',
  'chir-orale',
  'endo',
  'dent-resto',
  'paro',
  'proth',
  'sante-pub',
  'occluso',
  'pedo',
  'gero',
  'actu-pro',
] as const

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  // ── Référentiel clinique unifié news ↔ formations (charte §2) ──────────
  odf: { from: '#C026D3', to: '#E879F9', badge: '#C026D3', label: 'ODF / Orthodontie' },
  implanto: { from: '#10B981', to: '#34D399', badge: '#10B981', label: 'Implantologie' },
  'chir-orale': { from: '#EF4444', to: '#F87171', badge: '#EF4444', label: 'Chirurgie orale' },
  endo: { from: '#6366F1', to: '#818CF8', badge: '#6366F1', label: 'Endodontie' },
  'dent-resto': { from: '#F59E0B', to: '#FBBF24', badge: '#F59E0B', label: 'Dentisterie restauratrice' },
  paro: { from: '#EC4899', to: '#F472B6', badge: '#EC4899', label: 'Parodontologie' },
  proth: { from: '#F97316', to: '#FB923C', badge: '#F97316', label: 'Prothèse' },
  'sante-pub': { from: '#0284C7', to: '#38BDF8', badge: '#0284C7', label: 'Santé publique' },
  occluso: { from: '#65A30D', to: '#A3E635', badge: '#65A30D', label: 'Occlusodontie' },
  pedo: { from: '#EAB308', to: '#FDE047', badge: '#EAB308', label: 'Pédodontie' },
  gero: { from: '#7C2D12', to: '#C2410C', badge: '#7C2D12', label: 'Gérodontologie' },
  'actu-pro': { from: '#4B5563', to: '#9CA3AF', badge: '#4B5563', label: 'Actualité professionnelle' },

  // Catégories formation sans équivalent news
  esthetique: { from: '#8B5CF6', to: '#A78BFA', badge: '#8B5CF6', label: 'Esthétique' },
  numerique: { from: '#155E75', to: '#67E8F9', badge: '#155E75', label: 'Numérique & IA' },
  radiologie: { from: '#1E40AF', to: '#3B82F6', badge: '#1E40AF', label: 'Radiologie' },

  // ── Axe 3 — Relation Patient (charte §3) ────────────────────────────────
  communication: { from: '#FB7185', to: '#FDA4AF', badge: '#FB7185', label: 'Communication' },
  consentement: { from: '#2563EB', to: '#93C5FD', badge: '#2563EB', label: 'Consentement éclairé' },
  conflits: { from: '#9F1239', to: '#E11D48', badge: '#9F1239', label: 'Gestion des conflits' },
  'decision-partagee': { from: '#16A34A', to: '#4ADE80', badge: '#16A34A', label: 'Décision partagée' },
  'annonce-diagnostic': { from: '#B45309', to: '#F59E0B', badge: '#B45309', label: 'Annonce de diagnostic' },
  'education-therapeutique': { from: '#14B8A6', to: '#99F6E4', badge: '#14B8A6', label: 'Éducation thérapeutique' },
  'ethique-deontologie': { from: '#CA8A04', to: '#FDE68A', badge: '#CA8A04', label: 'Éthique & Déontologie' },
  'numerique-relation': { from: '#64748B', to: '#CBD5E1', badge: '#64748B', label: 'Numérique & Relation' },

  // ── Axe 4 — Santé Praticien (charte §4) ─────────────────────────────────
  ergonomie: { from: '#EC4899', to: '#F9A8D4', badge: '#EC4899', label: 'Ergonomie' },
  'stress-burnout': { from: '#86198F', to: '#D946EF', badge: '#86198F', label: 'Stress & Burn-out' },
  'risques-pro': { from: '#EA580C', to: '#FB923C', badge: '#EA580C', label: 'Risques professionnels' },
  violences: { from: '#991B1B', to: '#EF4444', badge: '#991B1B', label: 'Violences en milieu de soin' },
  'pratique-reflexive': { from: '#7C3AED', to: '#C4B5FD', badge: '#7C3AED', label: 'Pratique réflexive' },

  // ── Transverses & bonus (charte §5) ─────────────────────────────────────
  'soft-skills': { from: '#1E2A9A', to: '#3B4FD6', badge: '#1E2A9A', label: 'Soft Skills' },
  management: { from: '#78716C', to: '#A8A29E', badge: '#78716C', label: 'Management' },
  organisation: { from: '#64748B', to: '#94A3B8', badge: '#64748B', label: 'Organisation' },
}

/** Strip diacritics so "Dentisterie Restauratrice" matches key "restauratrice". */
function normalize(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/**
 * Résout un slug (catégorie formation, spécialité news, thème axe3/4) vers
 * son style de couleur canonique. Les alias formation (charte §2) résolvent
 * vers la même entrée que leur spécialité news — jamais de valeur recopiée.
 */
export function getCategoryStyle(slug: string | null | undefined): CategoryStyle {
  if (!slug) return NEUTRAL_STYLE
  const normalized = normalize(slug)
  const resolved = CATEGORY_ALIASES[normalized] ?? normalized
  if (CATEGORY_STYLES[resolved]) return CATEGORY_STYLES[resolved]
  for (const word of normalized.split(/\s+/)) {
    const w = CATEGORY_ALIASES[word] ?? word
    if (CATEGORY_STYLES[w]) return CATEGORY_STYLES[w]
  }
  return NEUTRAL_STYLE
}
