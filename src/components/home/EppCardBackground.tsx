import React from 'react'

/**
 * Fond partage des cartes EPP (Axe 2) — radial teal assombri + voile.
 * Source unique de verite visuelle : toute carte EPP (Reprendre, Mes
 * demarches en cours, page thematique) doit utiliser ce composant plutot
 * que dupliquer ces deux couches, pour qu'un futur changement de fond ne
 * se fasse qu'a un endroit. #0F7B6C = token Axe 2 (cf. src/lib/cp/axeColors.ts).
 */
export default function EppCardBackground() {
  return (
    <>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 70% 40%, #0F7B6Ccc 0%, #0F7B6C44 55%, #0d0d1a 100%)',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0.35) 100%)',
        }}
      />
    </>
  )
}
