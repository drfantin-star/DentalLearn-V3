import type { Timeline } from '@/lib/timeline/schema'

/**
 * Timeline mockée — 6 scènes (une par template) étalées sur ~100s.
 *
 * Sert exclusivement à la page POC `/admin/poc/whiteboard-templates` pour
 * tester `getActiveScene` en condition réelle (gaps, fenêtres, transitions)
 * et valider visuellement les templates livrés.
 *
 * T4.3 : tous les templates sont rendus pour de vrai (`grid`, `figures`,
 * `flowchart`, `comparison`, `timeline`, `causal`).
 */

export const MOCK_WHITEBOARD_TIMELINE: Timeline = {
  schema_version: '1.0',
  source_type: 'formation_sequence',
  source_id: 'mock-whiteboard-poc',
  audio_url: '',
  duration_sec: 100,
  generated_at: '2026-05-07T00:00:00.000Z',
  generator: 'manual_admin_edit',
  concepts: [],
  chapters: [],
  scenes: [
    // 0-12s : Grid (3 cols, classification spécialités)
    {
      id: 'scene-grid',
      title: 'Spécialités concernées',
      start_sec: 0,
      end_sec: 12,
      template: {
        kind: 'grid',
        columns: 3,
        cards: [
          { text: 'Endodontie', subtitle: 'Pulpe vivante' },
          { text: 'Restauratrice', subtitle: 'Reconstruction' },
          { text: 'Prothèse', subtitle: 'Couronne CFAO', variant: 'highlight' },
        ],
      },
    },
    // 15-27s : Figures (3 chiffres clés)
    {
      id: 'scene-figures',
      title: 'Chiffres clés',
      start_sec: 15,
      end_sec: 27,
      template: {
        kind: 'figures',
        figures: [
          { value: '67%', label: 'réduction du risque', emphasis: true },
          { value: 'n=412', label: 'patients étudiés' },
          { value: '5 ans', label: 'suivi moyen' },
        ],
      },
    },
    // 30-50s : Flowchart (T4.2)
    {
      id: 'scene-flowchart',
      title: 'Arbre diagnostic',
      start_sec: 30,
      end_sec: 50,
      template: {
        kind: 'flowchart',
        orientation: 'horizontal',
        cards: [
          { text: 'Douleur à la mastication', subtitle: 'Signe d\'appel' },
          { text: 'Test de morsure positif', subtitle: 'Examen' },
          { text: 'Imagerie CBCT si doute', subtitle: 'Confirmation' },
          {
            text: 'Syndrome dent fêlée',
            subtitle: 'Diagnostic',
            variant: 'highlight',
          },
        ],
      },
    },
    // 53-68s : Comparison (T4.2)
    {
      id: 'scene-comparison',
      title: 'Reconstitution corono-radiculaire',
      start_sec: 53,
      end_sec: 68,
      template: {
        kind: 'comparison',
        left: {
          title: 'Tenon fibré',
          cards: [
            { text: 'Module élastique proche dentine' },
            { text: 'Adhésif compatible' },
            { text: 'Retraitement aisé', variant: 'success' },
          ],
        },
        right: {
          title: 'Tenon métallique',
          cards: [
            { text: 'Module élevé' },
            { text: 'Risque fracture radiculaire', variant: 'warning' },
            { text: 'Retraitement difficile' },
          ],
        },
      },
    },
    // 70-85s : Causal (T4.3) — chaîne physiopathologique en mode nodes+edges
    {
      id: 'scene-causal',
      title: 'Mécanisme de la fêlure',
      start_sec: 70,
      end_sec: 85,
      template: {
        kind: 'causal',
        nodes: [
          { id: 'n1', text: 'Stress occlusal répété' },
          { id: 'n2', text: 'Microfissure émail' },
          { id: 'n3', text: 'Propagation dentine' },
          { id: 'n4', text: 'Fracture complète', variant: 'warning' },
        ],
        edges: [
          { from: 'n1', to: 'n2', label: 'fatigue' },
          { from: 'n2', to: 'n3' },
          { from: 'n3', to: 'n4', label: 'si non traité' },
        ],
      },
    },
    // 88-100s : Timeline (mode events, T4.2)
    {
      id: 'scene-timeline',
      title: 'Protocole de prise en charge',
      start_sec: 88,
      end_sec: 100,
      template: {
        kind: 'timeline',
        events: [
          { at_label: 'J0', text: 'Diagnostic clinique + CBCT' },
          { at_label: 'J7', text: 'Reconstitution provisoire' },
          { at_label: 'J21', text: 'Couronne définitive' },
          { at_label: '6 mois', text: 'Contrôle' },
        ],
      },
    },
  ],
}
