/**
 * Couleurs des 4 axes de la Certification Périodique (CP).
 *
 * SOURCE DE VÉRITÉ UNIQUE — toute surface CP (Radar, bandeaux d'attestation,
 * base des PDF) doit dériver sa couleur d'ici via l'`axe_cp`. Ne pas
 * réintroduire de hex en dur dans les composants : importer ces constantes.
 *
 * Trois représentations par axe, car chaque contexte de rendu diffère :
 *  - `hex`    : teinte canonique de l'axe (RadarCP : pastilles, dots, texte).
 *  - `banner` : classes Tailwind du bandeau de carte d'attestation. Dégradé
 *               dont le stop le plus sombre garantit le contraste du texte
 *               blanc ; le stop clair retombe sur la teinte canonique.
 *  - `pdfRgb` : couleur de base/en-tête des PDF jsPDF (texte blanc dessus),
 *               choisie pour rester lisible (équivalent ~-600 Tailwind, sauf
 *               teal qui est déjà optimal en `hex`).
 */
export interface AxeColor {
  hex: string
  banner: string
  pdfRgb: [number, number, number]
}

export const AXE_COLORS: Record<number, AxeColor> = {
  // Axe 1 — Compétences / Formations — violet
  1: { hex: '#8B5CF6', banner: 'from-violet-600 to-violet-500', pdfRgb: [124, 58, 237] },
  // Axe 2 — Qualité des pratiques / Audits EPP — teal
  2: { hex: '#0F7B6C', banner: 'from-teal-700 to-teal-600', pdfRgb: [15, 123, 108] },
  // Axe 3 — Relation patient / Démarche patient — orange
  3: { hex: '#F59E0B', banner: 'from-amber-600 to-amber-500', pdfRgb: [217, 119, 6] },
  // Axe 4 — Santé praticien / Auto-évaluation — rose
  4: { hex: '#EC4899', banner: 'from-pink-600 to-pink-500', pdfRgb: [219, 39, 119] },
}

/** Dégradé neutre pour une attestation sans axe CP (`axe_cp` null). */
export const NEUTRAL_BANNER = 'from-gray-600 to-gray-500'

/** Base PDF neutre pour une attestation sans axe CP (`axe_cp` null). */
export const NEUTRAL_PDF_RGB: [number, number, number] = [75, 85, 99]

/** Teinte canonique d'un axe (fallback violet/axe 1 si axe inconnu). */
export function axeHex(axe: number | null | undefined): string {
  return axe != null && AXE_COLORS[axe] ? AXE_COLORS[axe].hex : AXE_COLORS[1].hex
}

/** Classes Tailwind du bandeau de carte selon l'axe (neutre si null). */
export function axeBanner(axe: number | null | undefined): string {
  return axe != null && AXE_COLORS[axe] ? AXE_COLORS[axe].banner : NEUTRAL_BANNER
}

/** Couleur RGB de base d'un PDF d'attestation selon l'axe (neutre si null). */
export function axePdfRgb(axe: number | null | undefined): [number, number, number] {
  return axe != null && AXE_COLORS[axe] ? AXE_COLORS[axe].pdfRgb : NEUTRAL_PDF_RGB
}
