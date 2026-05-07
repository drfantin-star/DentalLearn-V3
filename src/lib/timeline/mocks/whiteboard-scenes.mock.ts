import type { Timeline } from '@/lib/timeline/schema'

/**
 * Timeline mockée — 6 scènes (une par template) étalées sur ~100s.
 *
 * Sert exclusivement à la page POC `/admin/poc/whiteboard-templates` pour
 * tester `getActiveScene` en condition réelle (gaps, fenêtres, transitions)
 * et valider visuellement les 2 templates livrés en T4.1 ainsi que les
 * placeholders des 4 autres templates (T4.2 / T4.3).
 *
 * ⚠️ Côté T4.1, seuls `grid` et `figures` sont rendus pour de vrai. Les
 * autres entrées sont là pour exercer le sélecteur du wrapper sur tous les
 * `kind` du discriminated union.
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
    // 30-50s : Flowchart (placeholder T4.2)
    {
      id: 'scene-flowchart',
      title: 'Arbre diagnostic',
      start_sec: 30,
      end_sec: 50,
      template: {
        kind: 'flowchart',
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
    // 53-68s : Comparison (placeholder T4.2)
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
            {
              text: 'Module élastique proche dentine',
              subtitle: 'Préserve la racine',
            },
          ],
        },
        right: {
          title: 'Tenon métallique',
          cards: [
            {
              text: 'Risque fracture radiculaire',
              subtitle: 'Module trop rigide',
              variant: 'warning',
            },
          ],
        },
      },
    },
    // 70-85s : Causal (placeholder T4.3)
    {
      id: 'scene-causal',
      title: 'Mécanisme de la fêlure',
      start_sec: 70,
      end_sec: 85,
      template: {
        kind: 'causal',
        cause: { text: 'Stress occlusal répété' },
        effects: [
          { text: 'Microfissure émail' },
          { text: 'Propagation dentine' },
          { text: 'Fracture complète', variant: 'warning' },
        ],
      },
    },
    // 88-100s : Timeline (placeholder T4.2)
    {
      id: 'scene-timeline',
      title: 'Protocole de prise en charge',
      start_sec: 88,
      end_sec: 100,
      template: {
        kind: 'timeline',
        steps: [
          { text: 'J0 — Diagnostic clinique + CBCT' },
          { text: 'J7 — Reconstitution provisoire' },
          { text: 'J21 — Couronne définitive' },
          { text: '6 mois — Contrôle' },
        ],
      },
    },
  ],
}
