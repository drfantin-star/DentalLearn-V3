import { TimelineSchema, type Scene, type Timeline } from '@/lib/timeline/schema'

/**
 * T8-B — Mapping déterministe `(episode + syntheses[])` → `Timeline`.
 *
 * 100% pur, pas d'appel LLM, pas d'I/O. Appelable côté serveur (route admin
 * generate-audio, factorisé via `generateAndPersistTimeline` dans
 * `src/lib/news-audio.ts` — cf. T8-E).
 *
 * Stratégie :
 *   - 1 chapitre par synthèse, partition uniforme de `episode.duration_s`.
 *   - À l'intérieur d'un chapitre, 4-7 scènes selon les champs disponibles
 *     (cf. tableau mapping spec POC §7.2 ré-affiné dans le prompt T8 v2).
 *   - Scène finale "recap" par synthèse (template T8-C, décision Q-T8-4=b).
 *   - Durées de scène internes proportionnelles à la durée du chapitre :
 *     chaque scène reçoit `(chapter_duration / N_scenes)`. Le composant
 *     `<NewsVisualSequence>` (T8-D) défile au rythme `isPlaying` via un
 *     timer interne et n'utilise PAS `start_sec`/`end_sec` global — ces
 *     bornes servent à valider Zod + à garder un layout cohérent côté
 *     timeline JSON.
 *
 * Décisions impliquées :
 *   - Q-T8-2=a : granularité épisode/journal (1 chapitre = 1 synthèse).
 *   - Q-T8-3=b : alignement par chapitre (pas de word-level news).
 *   - Q-T8-5=c : taxonomyLabels résolu en amont via `resolveTaxonomyLabels()`
 *     côté caller (BDD news_taxonomy).
 */

export type NewsSynthesisInput = {
  id: string
  position?: number
  display_title: string | null
  summary_fr: string | null
  specialite: string | null
  themes: string[] | null
  key_figures: string[] | null
  method: string | null
  evidence_level: string | null
  niveau_preuve: string | null
  clinical_impact: string | null
  caveats: string | null
}

export type NewsTimelineInput = {
  episode: {
    id: string
    type: 'digest' | 'insight' | 'journal'
    audio_url: string
    duration_s: number
  }
  syntheses: NewsSynthesisInput[]
  // Pré-résolu via resolveTaxonomyLabels(allSlugs) côté caller (Q-T8-5=c).
  // Clé = slug exact (specialite, theme, niveau_preuve). Valeur = label
  // français. Si une clé manque, fallback `capitalizeSlug(slug)` côté caller.
  taxonomyLabels: Record<string, string>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function clampCols(n: number): 1 | 2 | 3 | 4 {
  if (n <= 1) return 1
  if (n === 2) return 2
  if (n === 3) return 3
  return 4
}

/** Tronque à `max` chars en ajoutant '…' si dépassement. */
function truncate(text: string, max: number): string {
  if (!text) return ''
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return trimmed.slice(0, max - 1).trimEnd() + '…'
}

/** Capitalisation de fallback si un slug n'est pas dans taxonomyLabels. */
function capitalizeSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function resolveLabel(
  slug: string | null | undefined,
  labels: Record<string, string>,
): string | null {
  if (!slug) return null
  return labels[slug] ?? capitalizeSlug(slug)
}

/**
 * Parse un raw figure libre vers `{ value, label }`.
 *
 * Format observé en BDD (pré-flight #6, 204 synthèses) : texte libre du type
 *   "35 % de réduction du saignement gingival à 6 semaines"
 *   "OR=2.1 (IC95% 1.4–3.2)"
 *   "n=120 patients"
 * Heuristique : on extrait le premier nombre / pourcentage / ratio comme
 * `value`, et le reste comme `label`. Si rien d'extractible, le texte
 * entier devient `label` et `value="—"`.
 */
function parseFigure(
  rawFigure: string,
  emphasis: boolean,
): { value: string; label: string; emphasis?: boolean } {
  const raw = rawFigure.trim()
  if (!raw) return { value: '—', label: '', ...(emphasis ? { emphasis } : {}) }

  // Match : nombre optionnel + opérateur + nombre + suffixe %/×/etc.
  // Ex: "35 %", "OR=2.1", "n=120", "1.5×", "p<0.05"
  const m = raw.match(/^([A-Za-zµ]{0,4}\s*[=<>≤≥]?\s*[+-]?\d+(?:[.,]\d+)?\s*(?:%|×|x|‰)?)\s*(.*)$/)

  if (m && m[1] && m[1].length <= 16) {
    const value = m[1].trim()
    const label = truncate(m[2] ?? '', 40)
    return { value, label, ...(emphasis ? { emphasis } : {}) }
  }

  // Fallback : pas de chiffre identifiable → texte entier en label.
  return {
    value: '—',
    label: truncate(raw, 40),
    ...(emphasis ? { emphasis } : {}),
  }
}

// ─── Génération des scènes par synthèse ─────────────────────────────────────

type SceneSpec = {
  title: string
  template: Scene['template']
  /** Durée relative (poids) pour répartir le chapter_duration. */
  weight: number
}

function buildScenesForSynthesis(
  synthesis: NewsSynthesisInput,
  taxonomyLabels: Record<string, string>,
): SceneSpec[] {
  const specs: SceneSpec[] = []

  // 1. Spécialité + thèmes → grid
  const specialiteLabel = resolveLabel(synthesis.specialite, taxonomyLabels)
  const themeLabels = (synthesis.themes ?? [])
    .map((slug) => resolveLabel(slug, taxonomyLabels))
    .filter((x): x is string => x !== null)

  const allTopicLabels: string[] = []
  if (specialiteLabel) allTopicLabels.push(specialiteLabel)
  for (const t of themeLabels) {
    if (!allTopicLabels.includes(t)) allTopicLabels.push(t)
  }

  if (allTopicLabels.length > 0) {
    const columns = clampCols(allTopicLabels.length)
    specs.push({
      title: 'Spécialités concernées',
      template: {
        kind: 'grid',
        columns,
        cards: allTopicLabels.map((label, i) => ({
          text: truncate(label, 60),
          ...(i === 0 ? { variant: 'highlight' as const } : {}),
        })),
      },
      weight: 8,
    })
  }

  // 2. Key figures → figures (premier en emphasis)
  if (synthesis.key_figures && synthesis.key_figures.length > 0) {
    const items = synthesis.key_figures
      .slice(0, 3)
      .map((raw, i) => parseFigure(raw, i === 0))
    specs.push({
      title: 'Chiffres clés',
      template: { kind: 'figures', figures: items },
      weight: 12,
    })
  }

  // 3. Niveau de preuve (priorité niveau_preuve via taxonomy, fallback evidence_level brut)
  const niveauPreuveLabel = synthesis.niveau_preuve
    ? resolveLabel(synthesis.niveau_preuve, taxonomyLabels)
    : null
  const evidenceText = niveauPreuveLabel ?? synthesis.evidence_level
  if (evidenceText && evidenceText.trim().length > 0) {
    specs.push({
      title: 'Niveau de preuve',
      template: {
        kind: 'figures',
        figures: [
          {
            value: truncate(evidenceText, 16),
            label: 'Niveau de preuve',
            emphasis: true,
          },
        ],
      },
      weight: 5,
    })
  }

  // 4. Méthode → grid 1 col / 1 card pleine largeur
  if (synthesis.method && synthesis.method.trim().length > 0) {
    specs.push({
      title: 'Méthode',
      template: {
        kind: 'grid',
        columns: 1,
        cards: [
          {
            text: truncate(synthesis.method, 60),
          },
        ],
      },
      weight: 8,
    })
  }

  // 5. Clinical impact → grid 1 col / 1 card highlight
  if (synthesis.clinical_impact && synthesis.clinical_impact.trim().length > 0) {
    specs.push({
      title: 'Impact clinique',
      template: {
        kind: 'grid',
        columns: 1,
        cards: [
          {
            text: truncate(synthesis.clinical_impact, 60),
            variant: 'highlight' as const,
          },
        ],
      },
      weight: 12,
    })
  }

  // 6. Caveats → grid 1 col / 1 card warning
  if (synthesis.caveats && synthesis.caveats.trim().length > 0) {
    specs.push({
      title: 'Précautions',
      template: {
        kind: 'grid',
        columns: 1,
        cards: [
          {
            text: truncate(synthesis.caveats, 60),
            variant: 'warning' as const,
          },
        ],
      },
      weight: 10,
    })
  }

  // 7. Récap synthèse (sticky end de chapitre, transition vers la suivante)
  // — toujours présent, sauf si la synthèse est totalement vide (cas garde-fou
  // E3 du prompt, jamais déclenché en pratique vu pré-flight #6 = 204/204).
  if (specs.length > 0) {
    const recapTitle = truncate(
      `En résumé — ${synthesis.display_title ?? 'Synthèse'}`,
      80,
    )

    const recapFigures = synthesis.key_figures
      ? synthesis.key_figures
          .slice(0, 3)
          .map((raw, i) => parseFigure(raw, i === 0))
      : undefined

    specs.push({
      title: 'En résumé',
      template: {
        kind: 'recap',
        title: recapTitle,
        ...(recapFigures && recapFigures.length > 0
          ? { figures: recapFigures }
          : {}),
        ...(synthesis.clinical_impact
          ? { impact: truncate(synthesis.clinical_impact, 200) }
          : {}),
        ...(synthesis.caveats
          ? { caveats: truncate(synthesis.caveats, 160) }
          : {}),
      },
      weight: 8,
    })
  } else {
    // Garde-fou E3 : synthèse sans aucun champ exploitable. On crée quand
    // même 1 scène minimale pour ne pas casser l'index de queue côté front.
    specs.push({
      title: 'Synthèse simplifiée',
      template: {
        kind: 'grid',
        columns: 1,
        cards: [
          {
            text: truncate(
              synthesis.display_title ?? 'Synthèse',
              60,
            ),
          },
        ],
      },
      weight: 8,
    })
  }

  return specs
}

// ─── Construction de la Timeline globale ────────────────────────────────────

export function buildNewsTimeline(input: NewsTimelineInput): Timeline {
  const { episode, syntheses, taxonomyLabels } = input
  const N = Math.max(1, syntheses.length)
  const chapterDuration = episode.duration_s / N

  // Tri stable : par position si présent (journal via news_episode_syntheses),
  // sinon par ordre d'insertion donné par le caller.
  const sorted = [...syntheses].sort((a, b) => {
    const pa = a.position ?? Number.MAX_SAFE_INTEGER
    const pb = b.position ?? Number.MAX_SAFE_INTEGER
    return pa - pb
  })

  const chapters: Timeline['chapters'] = []
  const allScenes: Scene[] = []

  sorted.forEach((synthesis, idx) => {
    const chapterStart = idx * chapterDuration
    const chapterEnd =
      idx === N - 1 ? episode.duration_s : (idx + 1) * chapterDuration

    const sceneSpecs = buildScenesForSynthesis(synthesis, taxonomyLabels)
    const totalWeight = sceneSpecs.reduce((s, sp) => s + sp.weight, 0)
    const chapterDur = chapterEnd - chapterStart

    let cursor = chapterStart
    sceneSpecs.forEach((spec, sceneIdx) => {
      const sceneDur = (spec.weight / totalWeight) * chapterDur
      const sceneStart = cursor
      // Garantit `end_sec` strictement > `start_sec` (Zod refine).
      const sceneEnd =
        sceneIdx === sceneSpecs.length - 1
          ? chapterEnd
          : Math.min(chapterEnd, cursor + Math.max(0.5, sceneDur))
      cursor = sceneEnd

      allScenes.push({
        id: `${synthesis.id}-${sceneIdx}`,
        start_sec: sceneStart,
        end_sec: sceneEnd,
        title: spec.title,
        template: spec.template,
      })
    })

    chapters.push({
      id: synthesis.id,
      title: truncate(
        synthesis.display_title ?? `Synthèse ${idx + 1}`,
        80,
      ),
      start_sec: chapterStart,
      end_sec: chapterEnd,
    })
  })

  const timeline: Timeline = {
    schema_version: '1.0',
    source_type: 'news_synthesis',
    source_id: episode.id,
    audio_url: episode.audio_url,
    duration_sec: episode.duration_s,
    generated_at: new Date().toISOString(),
    generator: 'auto_news_deterministic',
    concepts: [],
    scenes: allScenes,
    chapters,
  }

  // Validation Zod additive — on log si fail mais on retourne quand même
  // (mode défensif vu que c'est déterministe et que les payloads sortants
  // sont garantis cohérents par construction). Si fail, indication d'un
  // bug du mapping à corriger en suivi.
  const parsed = TimelineSchema.safeParse(timeline)
  if (!parsed.success) {
    console.warn(
      '[buildNewsTimeline] Zod validation failed (returning anyway):',
      parsed.error.issues.slice(0, 5),
    )
  }

  return timeline
}
