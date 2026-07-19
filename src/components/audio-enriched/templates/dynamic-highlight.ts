import type { CardVariant } from '@/lib/timeline/schema'

/**
 * Surbrillance dynamique synchronisee audio (Lot 2, juillet 2026) — etat
 * visuel partage par les templates whiteboard.
 *
 * Decisions actees :
 *  - 2A : `variant: 'highlight'` n'est PLUS rendu (champ conserve dans les
 *    JSON, ignore au rendu). La mise en avant est desormais dynamique, pilotee
 *    par les bornes `highlight_at_sec` ecrites par l'enrichissement Lot 1.
 *  - 3A : `warning` / `success` restent rendus tels quels (semantiques).
 *  - 4A : `figures[].emphasis` n'est plus rendu non plus (meme sort que le
 *    highlight statique).
 *  - 8B : 2A/4A ne s'appliquent QU'AU lecteur formation. Le chemin news
 *    (`NewsVisualSequence`, timelines non enrichies) passe
 *    `staticVariantsEnabled: true` aux templates pour conserver l'ancien
 *    rendu statique (variant `highlight` + `emphasis`, pulse compris).
 *    Defaut `false` = comportement formation (player, preview admin, POC).
 *  - 7B (relais, calcule cote rendu) : l'item allume est celui dont le
 *    `highlight_at_sec` est le dernier declenche (`<= highlightTime`) de la
 *    scene ; il reste allume jusqu'au declenchement du suivant, extinction en
 *    fin de scene. Le declencheur actif est resolu par `StructuredWhiteboard`
 *    (qui connait la scene) et descend en prop `activeHighlightAt` ; chaque
 *    template n'a plus qu'a comparer l'`highlight_at_sec` de ses items.
 *
 * Style : meme famille visuelle teal token que l'ancien variant highlight,
 * transition douce (via `transition-colors duration-300` sur les cards),
 * aucun pulse.
 */

/** Classe d'un item allume — teal token, aucun hex en dur. */
export const LIT_CARD_CLASS =
  'bg-ds-turquoise/15 border-ds-turquoise/40 text-ds-turquoise'

/**
 * Variants encore rendus apres 2A/3A : warning et success uniquement.
 * `highlight` retombe volontairement sur le style neutre du template.
 */
const RENDERED_VARIANT_CLASS: Record<'warning' | 'success', string> = {
  warning: 'bg-amber-500/15 border-amber-500/40 text-amber-500',
  success: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
}

interface HighlightableItem {
  variant?: CardVariant
  highlight_at_sec?: number
}

/** Un item est allume ssi son declencheur EST le declencheur actif de la scene. */
export function isItemLit(
  item: { highlight_at_sec?: number },
  activeHighlightAt: number | null | undefined
): boolean {
  return (
    typeof activeHighlightAt === 'number' &&
    item.highlight_at_sec === activeHighlightAt
  )
}

/**
 * Classe d'etat complete d'une card : allume (teal dynamique) > variant
 * `highlight` statique (si `staticVariantsEnabled`, chemin news 8B) >
 * variant semantique (warning/success) > neutre. Par defaut (formation),
 * `variant: 'highlight'` est ignore (2A).
 */
export function cardStateClass(
  item: HighlightableItem,
  activeHighlightAt: number | null | undefined,
  neutralClass: string,
  staticVariantsEnabled = false
): string {
  if (isItemLit(item, activeHighlightAt)) return LIT_CARD_CLASS
  if (staticVariantsEnabled && item.variant === 'highlight') {
    return LIT_CARD_CLASS
  }
  if (item.variant === 'warning' || item.variant === 'success') {
    return RENDERED_VARIANT_CLASS[item.variant]
  }
  return neutralClass
}

/**
 * True quand la card est stylee (allumee ou variant rendu) — pilote la classe
 * du subtitle (`opacity-80` au lieu de `text-white/75`), meme regle que
 * l'ancien `card.variant ? ... : ...`.
 */
export function isCardAccented(
  item: HighlightableItem,
  activeHighlightAt: number | null | undefined,
  staticVariantsEnabled = false
): boolean {
  return (
    isItemLit(item, activeHighlightAt) ||
    (staticVariantsEnabled && item.variant === 'highlight') ||
    item.variant === 'warning' ||
    item.variant === 'success'
  )
}
