import type { Scene, Timeline } from './schema'

/**
 * Enrichissement déterministe des bornes de surbrillance par item de scène
 * (Lot 1 surbrillance audio, juillet 2026). AUCUN LLM : matching flou entre
 * le libellé de chaque item de template et le transcript word-level, restreint
 * à la fenêtre temporelle de la scène.
 *
 * Règles actées (validation Julie, juillet 2026) :
 *  - Fenêtre de recherche d'une scène : [start_sec, start_sec de la scène
 *    suivante) — ordre croissant des start_sec. Dernière scène : jusqu'à la
 *    fin de l'audio.
 *  - Normalisation : casse, accents (NFD), ponctuation -> espaces. Tokens
 *    retenus : longueur >= 3 hors stopwords, ou nombres de >= 2 chiffres.
 *  - Match token <-> mot : égalité exacte, ou stems égaux (chute des finales
 *    e/s répétées), ou préfixe commun de 5 caractères (les deux formes >= 5).
 *  - Seuil d'acceptation : >= 60 % des tokens du libellé matchés ET >= 2
 *    tokens matchés. Libellé mono-token : match exact requis.
 *  - Bornes écrites : tightest-span — plus petite fenêtre contiguë du
 *    transcript contenant au moins une occurrence de chaque token matché.
 *    Bornes BRUTES : le relais visuel (7B) est un choix de rendu du player
 *    (Lot 2), pas une donnée du JSON.
 *  - Collision inter-items (6A) : attribution gloutonne dans l'ordre des
 *    items ; les mots d'un span attribué ne sont plus disponibles pour les
 *    items suivants.
 *  - Repli : item sans bornes trouvées -> champs absents (aucune
 *    surbrillance côté player, comportement nominal, pas un bug).
 *  - Timeline sans transcript word-level (mode `auto_llm_extraction_approx`,
 *    séquences sans alignment ElevenLabs) : skip propre, timeline retournée
 *    inchangée.
 *
 * Module PUR : aucune dépendance React/Supabase/réseau. Consommé par la
 * route admin `/api/admin/timelines/enrich-highlights` (recalcul rétroactif,
 * Lot 1) puis par le bouton "recalculer" de l'éditeur de scènes (Lot 3).
 *
 * Cas de test documentés dans `highlight-matching.spec-cases.md` (pattern
 * spec-cases du projet, pas encore de runner de test installé).
 */

// ─── Types publics ───────────────────────────────────────────────────────────

export type HighlightMatchReason =
  | 'matched'
  | 'below_threshold'
  | 'window_consumed'
  | 'no_tokens'
  | 'empty_window'

export interface HighlightItemReport {
  scene_id: string
  /** Chemin lisible de l'item dans le template, ex : `left.cards[1]`, `nodes[2]`. */
  item_ref: string
  label: string
  total_tokens: number
  matched_tokens: number
  matched: boolean
  highlight_at_sec: number | null
  highlight_end_sec: number | null
  reason: HighlightMatchReason
}

export type HighlightSkipReason = 'no_word_level_transcript' | 'no_scenes'

export interface EnrichHighlightsResult {
  /**
   * Copie profonde de la timeline d'entrée avec les bornes écrites sur les
   * items matchés (et les bornes obsolètes retirées des items non matchés —
   * un recalcul est idempotent). Si `skipped`, référence l'objet d'entrée
   * inchangé.
   */
  timeline: Timeline
  items: HighlightItemReport[]
  skipped: boolean
  skipReason?: HighlightSkipReason
}

// ─── Normalisation ───────────────────────────────────────────────────────────

/**
 * Stopwords français (formes >= 3 lettres uniquement — les mots plus courts
 * sont déjà exclus par la règle de longueur). Liste volontairement courte :
 * on ne retire que les mots-outils sans valeur d'ancrage temporel.
 */
const STOPWORDS = new Set([
  'les',
  'des',
  'une',
  'sur',
  'pour',
  'pas',
  'avec',
  'dans',
  'par',
  'est',
  'aux',
  'cette',
  'qui',
  'que',
  'ces',
  'son',
  'ses',
  'ton',
  'tes',
])

/**
 * Minuscules + chute des accents (NFD) + ligatures oe/ae + tout caractère
 * non alphanumérique remplacé par un espace. Retourne les sous-parties non
 * vides ("l'occlusion" -> ["l", "occlusion"], "mésio-distal" -> ["mesio",
 * "distal"]).
 */
function normalizeToParts(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((p) => p !== '')
}

function isKeptToken(part: string): boolean {
  if (/^\d+$/.test(part)) return part.length >= 2
  return part.length >= 3 && !STOPWORDS.has(part)
}

/** Tokens de matching d'un libellé d'item (normalisés, filtrés, dédupliqués). */
export function labelTokens(label: string): string[] {
  const seen = new Set<string>()
  const tokens: string[] = []
  for (const part of normalizeToParts(label)) {
    if (isKeptToken(part) && !seen.has(part)) {
      seen.add(part)
      tokens.push(part)
    }
  }
  return tokens
}

/**
 * Stemming léger : chute des finales `e`/`s` répétées ("fêlées" -> "fel",
 * "fêlés" -> "fel"). Suffisant pour les flexions genre/nombre françaises
 * courantes sans dictionnaire.
 */
function lightStem(token: string): string {
  return token.replace(/[es]+$/, '')
}

/**
 * Match flou token de libellé <-> sous-partie de mot du transcript :
 * exact, stems égaux (>= 3 chars restants), ou préfixe 5 commun.
 */
function tokenMatchesPart(token: string, part: string): boolean {
  if (token === part) return true
  const st = lightStem(token)
  const sp = lightStem(part)
  if (st.length >= 3 && st === sp) return true
  if (token.length >= 5 && part.length >= 5 && token.slice(0, 5) === part.slice(0, 5)) {
    return true
  }
  return false
}

// ─── Mots du transcript ──────────────────────────────────────────────────────

interface MatchWord {
  start_sec: number
  end_sec: number
  parts: string[]
}

function flattenWords(timeline: Timeline): MatchWord[] {
  const words: MatchWord[] = []
  for (const segment of timeline.transcript?.segments ?? []) {
    for (const w of segment.words) {
      words.push({
        start_sec: w.start_sec,
        end_sec: w.end_sec,
        parts: normalizeToParts(w.text),
      })
    }
  }
  // Tri défensif par start_sec (le pipeline livre trié, on ne dépend pas de
  // cette garantie — même approche que getActiveScene).
  words.sort((a, b) => a.start_sec - b.start_sec)
  return words
}

// ─── Items par template ──────────────────────────────────────────────────────

/**
 * Poignée d'écriture sur un item : le matching est identique pour tous les
 * templates, seule la localisation des champs varie.
 */
interface ItemHandle {
  ref: string
  label: string
  target: Record<string, unknown>
}

/**
 * Extrait les items "surlignables" d'une scène, dans l'ordre d'attribution
 * gloutonne (6A) : ordre du tableau ; comparison = colonne gauche puis
 * droite ; causal = nodes (mode graphe) ou cause puis effects (mode étoile) ;
 * timeline = events (mode préféré) sinon steps ; recap = figures (impact et
 * caveats sont des chaînes nues, pas des objets — hors périmètre, cf.
 * spec-cases).
 */
function collectItems(scene: Scene): ItemHandle[] {
  const t = scene.template as unknown as Record<string, unknown>
  const items: ItemHandle[] = []

  const pushCards = (cards: unknown, prefix: string, labelKey: string) => {
    if (!Array.isArray(cards)) return
    cards.forEach((card, i) => {
      const c = card as Record<string, unknown>
      const label = typeof c[labelKey] === 'string' ? (c[labelKey] as string) : ''
      items.push({ ref: `${prefix}[${i}]`, label, target: c })
    })
  }

  switch (scene.template.kind) {
    case 'grid':
    case 'flowchart':
      pushCards(t.cards, 'cards', 'text')
      break
    case 'comparison': {
      const left = t.left as Record<string, unknown> | undefined
      const right = t.right as Record<string, unknown> | undefined
      pushCards(left?.cards, 'left.cards', 'text')
      pushCards(right?.cards, 'right.cards', 'text')
      break
    }
    case 'causal':
      if (Array.isArray(t.nodes) && t.nodes.length > 0) {
        pushCards(t.nodes, 'nodes', 'text')
      } else {
        if (t.cause && typeof t.cause === 'object') {
          const cause = t.cause as Record<string, unknown>
          items.push({
            ref: 'cause',
            label: typeof cause.text === 'string' ? cause.text : '',
            target: cause,
          })
        }
        pushCards(t.effects, 'effects', 'text')
      }
      break
    case 'figures':
      if (Array.isArray(t.figures)) {
        t.figures.forEach((fig, i) => {
          const f = fig as Record<string, unknown>
          const value = typeof f.value === 'string' ? f.value : ''
          const label = typeof f.label === 'string' ? f.label : ''
          items.push({
            ref: `figures[${i}]`,
            label: `${value} ${label}`.trim(),
            target: f,
          })
        })
      }
      break
    case 'timeline':
      if (Array.isArray(t.events) && t.events.length > 0) {
        t.events.forEach((ev, i) => {
          const e = ev as Record<string, unknown>
          const atLabel = typeof e.at_label === 'string' ? e.at_label : ''
          const text = typeof e.text === 'string' ? e.text : ''
          items.push({
            ref: `events[${i}]`,
            label: `${atLabel} ${text}`.trim(),
            target: e,
          })
        })
      } else {
        pushCards(t.steps, 'steps', 'text')
      }
      break
    case 'recap':
      if (Array.isArray(t.figures)) {
        t.figures.forEach((fig, i) => {
          const f = fig as Record<string, unknown>
          const value = typeof f.value === 'string' ? f.value : ''
          const label = typeof f.label === 'string' ? f.label : ''
          items.push({
            ref: `figures[${i}]`,
            label: `${value} ${label}`.trim(),
            target: f,
          })
        })
      }
      break
  }
  return items
}

// ─── Matching d'un item dans une fenêtre ─────────────────────────────────────

interface SpanResult {
  matchedTokens: number
  totalTokens: number
  accepted: boolean
  at: number | null
  end: number | null
}

/**
 * Applique le matching flou d'un libellé sur les mots disponibles d'une
 * fenêtre, et calcule le tightest-span : plus petite fenêtre contiguë (en
 * secondes) contenant au moins une occurrence de chaque token matché
 * (fenêtre glissante sur les occurrences triées).
 */
function matchLabelInWindow(
  tokens: string[],
  windowWords: MatchWord[]
): SpanResult {
  const total = tokens.length
  if (total === 0) {
    return { matchedTokens: 0, totalTokens: 0, accepted: false, at: null, end: null }
  }

  // Occurrences (mot, index de token) pour chaque token trouvé quelque part.
  const occurrences: Array<{ word: MatchWord; tokenIndex: number }> = []
  const matchedSet = new Set<number>()
  for (const word of windowWords) {
    for (let ti = 0; ti < tokens.length; ti++) {
      const isMatch =
        tokens.length === 1
          ? word.parts.includes(tokens[ti]) // mono-token : exact requis
          : word.parts.some((p) => tokenMatchesPart(tokens[ti], p))
      if (isMatch) {
        occurrences.push({ word, tokenIndex: ti })
        matchedSet.add(ti)
      }
    }
  }

  const matched = matchedSet.size
  const accepted =
    total === 1 ? matched === 1 : matched >= 2 && matched / total >= 0.6

  if (!accepted) {
    return { matchedTokens: matched, totalTokens: total, accepted: false, at: null, end: null }
  }

  // Tightest-span sur les occurrences (déjà en ordre start_sec croissant car
  // windowWords est trié). Fenêtre glissante classique de couverture minimale.
  const need = matched
  const counts = new Map<number, number>()
  let covered = 0
  let bestAt: number | null = null
  let bestEnd: number | null = null
  let bestSpan = Number.POSITIVE_INFINITY
  let lo = 0
  for (let hi = 0; hi < occurrences.length; hi++) {
    const tokHi = occurrences[hi].tokenIndex
    counts.set(tokHi, (counts.get(tokHi) ?? 0) + 1)
    if (counts.get(tokHi) === 1) covered++
    while (covered === need) {
      const at = occurrences[lo].word.start_sec
      const end = occurrences[hi].word.end_sec
      const span = end - at
      if (span < bestSpan) {
        bestSpan = span
        bestAt = at
        bestEnd = end
      }
      const tokLo = occurrences[lo].tokenIndex
      counts.set(tokLo, (counts.get(tokLo) ?? 0) - 1)
      if (counts.get(tokLo) === 0) covered--
      lo++
    }
  }

  return {
    matchedTokens: matched,
    totalTokens: total,
    accepted: bestAt !== null,
    at: bestAt,
    end: bestEnd,
  }
}

// ─── Entrée principale ───────────────────────────────────────────────────────

/**
 * Enrichit une timeline avec les bornes `highlight_at_sec`/`highlight_end_sec`
 * par item. Fonction pure et idempotente : l'entrée n'est jamais mutée, les
 * bornes préexistantes sont recalculées (écrites si match, retirées sinon).
 */
export function enrichTimelineHighlights(
  timeline: Timeline
): EnrichHighlightsResult {
  if (!timeline.scenes.length) {
    return { timeline, items: [], skipped: true, skipReason: 'no_scenes' }
  }

  const words = flattenWords(timeline)
  if (!words.length) {
    return {
      timeline,
      items: [],
      skipped: true,
      skipReason: 'no_word_level_transcript',
    }
  }

  // Copie profonde : la timeline est du JSON pur (issue de TimelineSchema).
  const enriched = JSON.parse(JSON.stringify(timeline)) as Timeline
  const scenes = [...enriched.scenes].sort((a, b) => a.start_sec - b.start_sec)
  const report: HighlightItemReport[] = []

  for (let si = 0; si < scenes.length; si++) {
    const scene = scenes[si]
    const winStart = scene.start_sec
    const winEnd =
      si + 1 < scenes.length
        ? scenes[si + 1].start_sec
        : Number.POSITIVE_INFINITY
    const windowWords = words.filter(
      (w) => w.start_sec >= winStart && w.start_sec < winEnd
    )

    // Intervalles consommés par les items déjà attribués de cette scène (6A).
    const consumed: Array<{ at: number; end: number }> = []
    const isAvailable = (w: MatchWord) =>
      !consumed.some((c) => w.start_sec < c.end && w.end_sec > c.at)

    for (const item of collectItems(scene)) {
      const tokens = labelTokens(item.label)

      // Recalcul idempotent : on repart d'un item vierge de bornes.
      delete item.target.highlight_at_sec
      delete item.target.highlight_end_sec

      const base: Omit<
        HighlightItemReport,
        'matched' | 'highlight_at_sec' | 'highlight_end_sec' | 'reason'
      > = {
        scene_id: scene.id,
        item_ref: item.ref,
        label: item.label,
        total_tokens: tokens.length,
        matched_tokens: 0,
      }

      if (tokens.length === 0) {
        report.push({
          ...base,
          matched: false,
          highlight_at_sec: null,
          highlight_end_sec: null,
          reason: 'no_tokens',
        })
        continue
      }
      if (windowWords.length === 0) {
        report.push({
          ...base,
          matched: false,
          highlight_at_sec: null,
          highlight_end_sec: null,
          reason: 'empty_window',
        })
        continue
      }

      const available = windowWords.filter(isAvailable)
      const result = matchLabelInWindow(tokens, available)

      if (result.accepted && result.at !== null && result.end !== null) {
        item.target.highlight_at_sec = result.at
        item.target.highlight_end_sec = result.end
        consumed.push({ at: result.at, end: result.end })
        report.push({
          ...base,
          matched_tokens: result.matchedTokens,
          matched: true,
          highlight_at_sec: result.at,
          highlight_end_sec: result.end,
          reason: 'matched',
        })
        continue
      }

      // Échec : distinguer "les mots ont été consommés par un item précédent"
      // (6A) d'un vrai déficit lexical, pour la lisibilité du rapport dry-run.
      const wouldMatchWithoutConsumption =
        consumed.length > 0 && matchLabelInWindow(tokens, windowWords).accepted
      report.push({
        ...base,
        matched_tokens: result.matchedTokens,
        matched: false,
        highlight_at_sec: null,
        highlight_end_sec: null,
        reason: wouldMatchWithoutConsumption
          ? 'window_consumed'
          : 'below_threshold',
      })
    }
  }

  return { timeline: enriched, items: report, skipped: false }
}
