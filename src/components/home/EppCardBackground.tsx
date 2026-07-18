import React from 'react'
import { axeHex } from '@/lib/cp/axeColors'
import { getCategoryStyle } from '@/lib/design/categoryStyle'

/**
 * Fond partage des cartes EPP — radial teal assombri + voile.
 * Source unique de verite visuelle : toute carte EPP (Reprendre, Mes
 * demarches en cours, page thematique) doit utiliser ce composant plutot
 * que dupliquer ces deux couches, pour qu'un futur changement de fond ne
 * se fasse qu'a un endroit.
 * Quand themeSlug est fourni, la couleur derive de getCategoryStyle(theme)
 * (couleur clinique du theme de l'audit) ; sinon, repli sur axeHex(2).
 */
export default function EppCardBackground({ themeSlug }: { themeSlug?: string | null }) {
  const color = themeSlug ? getCategoryStyle(themeSlug).from : axeHex(2)
  return (
    <>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 70% 40%, ${color}cc 0%, ${color}44 55%, #0d0d1a 100%)`,
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
