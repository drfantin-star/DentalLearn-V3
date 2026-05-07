import { z } from 'zod'

/**
 * Schémas Zod du Timeline v1.0 — référence : spec POC §2.1.
 *
 * Sert à valider runtime les `*.timeline.json` produits par le pipeline Python
 * (T2) avant consommation côté client. Réutilisable par T4-T8 pour valider
 * scenes (discriminated union sur `template.kind`), concepts, et outputs LLM.
 *
 * Tous les types TypeScript sont dérivés via `z.infer<>` et exportés.
 */

// ─── Atomes ──────────────────────────────────────────────────────────────────

const SpeakerSchema = z.enum(['sophie', 'martin'])

const TimelineWordSchema = z.object({
  start_sec: z.number().nonnegative(),
  end_sec: z.number().nonnegative(),
  text: z.string().min(1),
})

const TimelineSegmentSchema = z.object({
  start_sec: z.number().nonnegative(),
  end_sec: z.number().nonnegative(),
  speaker: SpeakerSchema,
  text: z.string(),
  words: z.array(TimelineWordSchema).default([]),
})

// ─── Concepts ────────────────────────────────────────────────────────────────

const TimelineConceptSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  start_sec: z.number().nonnegative(),
  end_sec: z.number().nonnegative(),
  importance: z.number().min(0).max(1).optional(),
})

// ─── Card content (utilisé par les templates whiteboard) ────────────────────
// Limites de longueur cf. spec §2.1 — appliquées strictement pour empêcher
// un overflow visuel côté templates whiteboard (T4).
//
// `variant` (ajouté T4.1) : permet de marquer visuellement une card comme
// importante (`highlight`), risquée (`warning`) ou positive (`success`).
// Ajout strictement additif (optionnel) — les payloads T3 restent valides.

const CardVariantSchema = z.enum(['highlight', 'warning', 'success'])

const CardContentSchema = z.object({
  text: z.string().max(60),
  subtitle: z.string().max(40).optional(),
  icon: z.string().optional(),
  variant: CardVariantSchema.optional(),
})

// ─── Templates de scène (discriminated union sur `kind`) ────────────────────

const FlowchartTemplateSchema = z.object({
  kind: z.literal('flowchart'),
  cards: z.array(CardContentSchema),
  // `orientation` (ajouté T4.2) : direction du flowchart.
  // Optionnel — défaut 'horizontal' côté composant. Payloads T3 restent valides.
  orientation: z.enum(['horizontal', 'vertical']).optional(),
})

const GridTemplateSchema = z.object({
  kind: z.literal('grid'),
  columns: z.number().int().positive(),
  cards: z.array(CardContentSchema),
})

const ComparisonTemplateSchema = z.object({
  kind: z.literal('comparison'),
  left: z.object({
    title: z.string(),
    cards: z.array(CardContentSchema),
  }),
  right: z.object({
    title: z.string(),
    cards: z.array(CardContentSchema),
  }),
})

const CausalTemplateSchema = z.object({
  kind: z.literal('causal'),
  cause: CardContentSchema,
  effects: z.array(CardContentSchema),
})

const FiguresTemplateSchema = z.object({
  kind: z.literal('figures'),
  figures: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
      // `emphasis` (ajouté T4.1) : met en avant le chiffre (couleur turquoise
      // + pulse subtil). Optionnel — payloads T3 restent valides.
      emphasis: z.boolean().optional(),
    })
  ),
})

const TimelineTemplateSchema = z
  .object({
    kind: z.literal('timeline'),
    // Mode "steps" (T3 legacy) : liste de cards rendues en frise simple.
    steps: z.array(CardContentSchema).optional(),
    // Mode "events" (T4.2, conforme spec POC §5.2) : frise chronologique
    // avec labels temporels. Si présent, les composants Timeline préfèrent
    // ce mode à `steps`.
    events: z
      .array(
        z.object({
          at_label: z.string().min(1), // ex : "J0", "J7", "6 mois"
          text: z.string().min(1),
        })
      )
      .optional(),
  })
  .refine(
    (t) =>
      (t.steps && t.steps.length > 0) || (t.events && t.events.length > 0),
    { message: 'timeline template requires either steps[] or events[]' }
  )

const SceneTemplateSchema = z.discriminatedUnion('kind', [
  FlowchartTemplateSchema,
  GridTemplateSchema,
  ComparisonTemplateSchema,
  CausalTemplateSchema,
  FiguresTemplateSchema,
  TimelineTemplateSchema,
])

// ─── Scenes & Chapters ───────────────────────────────────────────────────────

const SceneSchema = z.object({
  id: z.string().min(1),
  start_sec: z.number().nonnegative(),
  end_sec: z.number().nonnegative(),
  title: z.string().optional(),
  template: SceneTemplateSchema,
})

const ChapterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  start_sec: z.number().nonnegative(),
  end_sec: z.number().nonnegative(),
})

// ─── Transcript ──────────────────────────────────────────────────────────────

const TranscriptSchema = z.object({
  segments: z.array(TimelineSegmentSchema).default([]),
})

// ─── Schéma racine ───────────────────────────────────────────────────────────

export const TimelineSchema = z.object({
  schema_version: z.literal('1.0'),
  source_type: z.enum(['formation_sequence', 'news_synthesis']),
  source_id: z.string().min(1),
  audio_url: z.string(),
  duration_sec: z.number().positive(),
  generated_at: z.string().min(1),
  generator: z.enum([
    'auto_python_pipeline',
    'auto_llm_extraction',
    'manual_admin_edit',
  ]),
  transcript: TranscriptSchema.optional(),
  concepts: z.array(TimelineConceptSchema).default([]),
  scenes: z.array(SceneSchema).default([]),
  chapters: z.array(ChapterSchema).default([]),
})

// ─── Types exportés (dérivés via z.infer) ───────────────────────────────────

export type Timeline = z.infer<typeof TimelineSchema>
export type TimelineSegment = z.infer<typeof TimelineSegmentSchema>
export type TimelineWord = z.infer<typeof TimelineWordSchema>
export type TimelineConcept = z.infer<typeof TimelineConceptSchema>
export type Scene = z.infer<typeof SceneSchema>
export type SceneTemplate = z.infer<typeof SceneTemplateSchema>
export type CardContent = z.infer<typeof CardContentSchema>
export type CardVariant = z.infer<typeof CardVariantSchema>
export type Speaker = z.infer<typeof SpeakerSchema>
