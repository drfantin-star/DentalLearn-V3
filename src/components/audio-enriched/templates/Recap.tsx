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
  /**
   * Variante typographique (ajout additif, juillet 2026) :
   *  - 'default' : tailles historiques — scenes defilantes de
   *    NewsVisualSequence (espace contraint), rendu inchange.
   *  - 'comfortable' : corps a 16px / interligne relaxed, chiffres cles un
   *    cran au-dessus — carte statique NewsRecapCard du detail news.
   */
  size?: 'default' | 'comfortable'
}

export function Recap({
  title,
  figures,
  impact,
  caveats,
  className,
  size = 'default',
}: RecapProps) {
  const hasFigures = !!figures && figures.length > 0
  const hasImpact = !!impact && impact.trim().length > 0
  const hasBody = hasFigures || hasImpact
  const comfortable = size === 'comfortable'

  const titleClass = comfortable ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'
  const kickerClass = comfortable ? 'text-xs' : 'text-[10px]'
  const figureValueClass = comfortable
    ? 'text-xl sm:text-2xl'
    : 'text-lg sm:text-xl'
  const figureLabelClass = comfortable
    ? 'text-base text-white/75 leading-snug'
    : 'text-xs text-white/75 leading-tight'
  const impactClass = comfortable
    ? 'text-base leading-relaxed'
    : 'text-sm leading-snug'
  const caveatsClass = comfortable
    ? 'text-base text-white/75 leading-relaxed'
    : 'text-xs text-white/75 leading-snug'

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={`bg-[color:var(--color-bg-card)] border border-white/10 rounded-xl p-4 sm:p-5 ${className ?? ''}`}
    >
      {/* Header — le h3 est saute si le titre est vide (NewsRecapCard ne
          duplique plus le titre du modal juste au-dessus) ; le kicker
          « En résumé » reste. Les scenes journal passent toujours un titre. */}
      <header className="mb-3 sm:mb-4">
        <p className="text-xs uppercase tracking-wider text-ds-turquoise font-semibold">
          En résumé
        </p>
        {title.trim().length > 0 && (
          <h3 className={`${titleClass} font-bold text-[color:var(--color-text-primary)] leading-tight mt-1`}>
            {title}
          </h3>
        )}
      </header>

      {/* Body 2 colonnes */}
      {hasBody && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Gauche : chiffres clés */}
          {hasFigures && (
            <div className="space-y-2">
              <p className={`${kickerClass} uppercase tracking-wider text-[color:var(--color-text-primary)] font-semibold`}>
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
                        className={`${figureValueClass} font-bold leading-none shrink-0 ${
                          isEmphasis
                            ? 'text-ds-turquoise'
                            : 'text-[color:var(--color-text-primary)]'
                        }`}
                      >
                        {fig.value}
                      </span>
                      {fig.label && (
                        <span className={figureLabelClass}>
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
              <p className={`${kickerClass} uppercase tracking-wider text-[color:var(--color-text-primary)] font-semibold`}>
                Impact clinique
              </p>
              <p className={`${impactClass} text-[color:var(--color-text-primary)]`}>
                {impact}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Footer : limites (warning compact) */}
      {caveats && caveats.trim().length > 0 && (
        <footer className="mt-3 sm:mt-4 pt-3 border-t border-white/5">
          <p className={`${kickerClass} uppercase tracking-wider text-axe3 font-semibold mb-1`}>
            Limites
          </p>
          <p className={caveatsClass}>
            {caveats}
          </p>
        </footer>
      )}
    </motion.div>
  )
}
