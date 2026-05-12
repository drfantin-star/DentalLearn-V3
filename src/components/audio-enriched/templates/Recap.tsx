'use client'

import { motion } from 'framer-motion'

/**
 * Template "recap" (T8-C, décision Q-T8-4=b) : carte récapitulative à 2
 * colonnes "Chiffres clés / Impact clinique" + footer optionnel "Limites".
 *
 * Usages :
 *  - scène finale de chaque chapitre dans `<NewsVisualSequence>` (transition
 *    douce vers la synthèse suivante) ;
 *  - carte statique screenshot-able dans NewsModal via `<NewsRecapCard>`
 *    (T8-D), sans défilement.
 *
 * Design tokens : alignés avec Grid/Figures (couleurs ds-turquoise pour
 * emphasis, axe3 pour warning, fond `--color-bg-card`). Responsive : stack
 * en colonne unique < 640px (sm:grid-cols-2 desktop).
 *
 * Ajout strictement additif — les 6 templates existants ne sont pas touchés.
 */

export interface RecapFigure {
  value: string
  label: string
  emphasis?: boolean
}

interface RecapProps {
  title: string
  figures?: RecapFigure[]
  impact?: string
  caveats?: string
  className?: string
}

export function Recap({ title, figures, impact, caveats, className }: RecapProps) {
  const hasFigures = !!figures && figures.length > 0
  const hasImpact = !!impact && impact.trim().length > 0
  const hasBody = hasFigures || hasImpact

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={`bg-[color:var(--color-bg-card)] border border-white/10 rounded-xl p-4 sm:p-5 ${className ?? ''}`}
    >
      {/* Header */}
      <header className="mb-3 sm:mb-4">
        <p className="text-xs uppercase tracking-wider text-ds-turquoise font-semibold">
          En résumé
        </p>
        <h3 className="text-base sm:text-lg font-bold text-[color:var(--color-text-primary)] leading-tight mt-1">
          {title}
        </h3>
      </header>

      {/* Body 2 colonnes */}
      {hasBody && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Gauche : chiffres clés */}
          {hasFigures && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-secondary)] font-semibold">
                Chiffres clés
              </p>
              <div className="space-y-1.5">
                {figures!.map((fig, i) => {
                  const isEmphasis = !!fig.emphasis
                  return (
                    <div
                      key={i}
                      className={`flex items-baseline gap-2 rounded-md border px-2 py-1.5 ${
                        isEmphasis
                          ? 'bg-ds-turquoise/10 border-ds-turquoise/40'
                          : 'bg-black/20 border-white/5'
                      }`}
                    >
                      <span
                        className={`text-lg sm:text-xl font-bold leading-none shrink-0 ${
                          isEmphasis
                            ? 'text-ds-turquoise'
                            : 'text-[color:var(--color-text-primary)]'
                        }`}
                      >
                        {fig.value}
                      </span>
                      {fig.label && (
                        <span className="text-xs text-[color:var(--color-text-secondary)] leading-tight">
                          {fig.label}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Droite : impact clinique */}
          {hasImpact && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-secondary)] font-semibold">
                Impact clinique
              </p>
              <p className="text-sm text-[color:var(--color-text-primary)] leading-snug">
                {impact}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Footer : limites (warning compact) */}
      {caveats && caveats.trim().length > 0 && (
        <footer className="mt-3 sm:mt-4 pt-3 border-t border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-axe3 font-semibold mb-1">
            Limites
          </p>
          <p className="text-xs text-[color:var(--color-text-secondary)] leading-snug">
            {caveats}
          </p>
        </footer>
      )}
    </motion.div>
  )
}
