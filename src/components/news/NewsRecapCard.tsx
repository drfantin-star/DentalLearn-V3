'use client'

import { Recap } from '@/components/audio-enriched/templates/Recap'

/**
 * T8-D — `<NewsRecapCard>` : carte récapitulative **statique** (pas de
 * défilement) pour NewsModal sur une synthèse isolée.
 *
 * Diffère de `<NewsVisualSequence>` (timeline complète défilante) en ce que :
 *  - pas de couplage AudioPlayerContext,
 *  - pas de timer,
 *  - juste un screenshot-able 2 colonnes Chiffres / Impact + footer Limites.
 *
 * Réutilise le même `<Recap>` template que la timeline (cohérence visuelle
 * garantie). Mapping `synthesis` → props `<Recap>` fait ici (parsing minimal,
 * pas de dépendance au schema Zod Timeline).
 *
 * Décision Q-T8-1=a (bonus carte statique NewsModal).
 */

export interface NewsRecapCardSynthesis {
  display_title: string | null
  key_figures: string[] | null
  clinical_impact: string | null
  caveats: string | null
}

interface NewsRecapCardProps {
  synthesis: NewsRecapCardSynthesis
  className?: string
}

function truncate(text: string, max: number): string {
  if (!text) return ''
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return trimmed.slice(0, max - 1).trimEnd() + '…'
}

/** Parse un raw figure libre vers `{ value, label }` (même heuristique que
 *  buildNewsTimeline, dupliquée ici pour découpler le composant client de
 *  la lib server-side). */
function parseFigure(
  rawFigure: string,
  emphasis: boolean,
): { value: string; label: string; emphasis?: boolean } {
  const raw = rawFigure.trim()
  if (!raw) return { value: '—', label: '', ...(emphasis ? { emphasis } : {}) }
  const m = raw.match(/^([A-Za-zµ]{0,4}\s*[=<>≤≥]?\s*[+-]?\d+(?:[.,]\d+)?\s*(?:%|×|x|‰)?)\s*(.*)$/)
  if (m && m[1] && m[1].length <= 16) {
    return {
      value: m[1].trim(),
      label: truncate(m[2] ?? '', 40),
      ...(emphasis ? { emphasis } : {}),
    }
  }
  return {
    value: '—',
    label: truncate(raw, 40),
    ...(emphasis ? { emphasis } : {}),
  }
}

export function NewsRecapCard({ synthesis, className }: NewsRecapCardProps) {
  const figures = synthesis.key_figures
    ? synthesis.key_figures
        .slice(0, 3)
        .map((raw, i) => parseFigure(raw, i === 0))
    : undefined

  const title = truncate(
    `En résumé — ${synthesis.display_title ?? 'Synthèse'}`,
    80,
  )

  return (
    <Recap
      title={title}
      figures={figures}
      impact={
        synthesis.clinical_impact
          ? truncate(synthesis.clinical_impact, 200)
          : undefined
      }
      caveats={
        synthesis.caveats ? truncate(synthesis.caveats, 160) : undefined
      }
      className={className}
    />
  )
}
