/**
 * Helpers de défauts pour les 6 templates whiteboard (POC-T6.3).
 *
 * Utilisé par :
 *  - L'ajout d'une scène (template = grid 2 cards) — `getDefaultTemplatePayload('grid')`
 *  - Le changement de `template.kind` (modal de confirmation) — décision D5
 *
 * Tous les payloads retournés DOIVENT passer le `TimelineSchema` Zod (la
 * route PUT ré-valide strict). Cf. `src/lib/timeline/schema.ts`.
 */

import type { SceneTemplate } from './schema'

export function getDefaultTemplatePayload(
  kind: SceneTemplate['kind']
): SceneTemplate {
  switch (kind) {
    case 'flowchart':
      return {
        kind: 'flowchart',
        orientation: 'horizontal',
        cards: [{ text: 'Étape 1' }, { text: 'Étape 2' }],
      }
    case 'grid':
      return {
        kind: 'grid',
        columns: 2,
        cards: [{ text: 'Card 1' }, { text: 'Card 2' }],
      }
    case 'comparison':
      return {
        kind: 'comparison',
        left: { title: 'Option A', cards: [{ text: 'Avantage 1' }] },
        right: { title: 'Option B', cards: [{ text: 'Avantage 1' }] },
      }
    case 'figures':
      return {
        kind: 'figures',
        figures: [{ value: '50%', label: 'À éditer' }],
      }
    case 'causal':
      return {
        kind: 'causal',
        nodes: [
          { id: 'n1', text: 'Cause' },
          { id: 'n2', text: 'Effet' },
        ],
        edges: [{ from: 'n1', to: 'n2' }],
      }
    case 'timeline':
      return {
        kind: 'timeline',
        events: [{ at_label: 'Étape 1', text: 'À éditer' }],
      }
  }
}

/**
 * Liste ordonnée pour les dropdowns UI (ordre stable d'affichage).
 */
export const TEMPLATE_KINDS: ReadonlyArray<SceneTemplate['kind']> = [
  'grid',
  'flowchart',
  'comparison',
  'figures',
  'causal',
  'timeline',
] as const

/**
 * Libellés humains FR pour les dropdowns admin.
 */
export const TEMPLATE_KIND_LABELS: Record<SceneTemplate['kind'], string> = {
  grid: 'Grille',
  flowchart: 'Flowchart',
  comparison: 'Comparaison',
  figures: 'Chiffres clés',
  causal: 'Graphe causal',
  timeline: 'Frise chronologique',
}
