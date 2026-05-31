/**
 * Couleurs des 4 axes de la Certification Périodique (CP).
 *
 * SOURCE DE VÉRITÉ UNIQUE — toute surface CP (Radar, bandeaux d'attestation,
 * base des PDF) doit dériver sa couleur d'ici via l'`axe_cp`. Ne pas
 * réintroduire de hex en dur dans les composants : importer ces constantes.
 *
 * Deux teintes par axe :
 *  - `hex`  : teinte canonique de l'axe (RadarCP : pastilles, dots, texte ;
 *             stop clair du dégradé de bandeau).
 *  - `dark` : teinte sombre — stop sombre du dégradé de bandeau ET couleur de
 *             base/en-tête des PDF (texte blanc dessus), choisie pour le
 *             contraste.
 *
 * NB : les couleurs des bandeaux et PDF sont appliquées en `style` inline
 * (hex), pas via des classes Tailwind générées — le scan Tailwind ne couvre
 * pas `src/lib`, donc des classes dynamiques posées ici ne seraient jamais
 * incluses dans le CSS.
 */
export interface AxeColor {
  hex: string
  dark: string
}

export const AXE_COLORS: Record<number, AxeColor> = {
  // Axe 1 — Compétences / Formations — violet
  1: { hex: '#8B5CF6', dark: '#7C3AED' },
  // Axe 2 — Qualité des pratiques / Audits EPP — teal
  2: { hex: '#0F7B6C', dark: '#0F7B6C' },
  // Axe 3 — Relation patient / Démarche patient — orange
  3: { hex: '#F59E0B', dark: '#D97706' },
  // Axe 4 — Santé praticien / Auto-évaluation — rose
  4: { hex: '#EC4899', dark: '#DB2777' },
}

/** Teinte neutre pour une attestation sans axe CP (`axe_cp` null). */
export const NEUTRAL: AxeColor = { hex: '#6B7280', dark: '#4B5563' }

function colorFor(axe: number | null | undefined): AxeColor {
  return axe != null && AXE_COLORS[axe] ? AXE_COLORS[axe] : NEUTRAL
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Teinte canonique d'un axe (radar, pastilles). */
export function axeHex(axe: number | null | undefined): string {
  return colorFor(axe).hex
}

/** Dégradé CSS (sombre → clair) du bandeau de carte d'attestation, à poser en `style`. */
export function axeBannerStyle(axe: number | null | undefined): string {
  const c = colorFor(axe)
  return `linear-gradient(to right, ${c.dark}, ${c.hex})`
}

/** Couleur RGB de base d'un PDF d'attestation selon l'axe (teinte sombre, texte blanc). */
export function axePdfRgb(axe: number | null | undefined): [number, number, number] {
  return hexToRgb(colorFor(axe).dark)
}
