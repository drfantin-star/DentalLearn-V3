'use client'

import LightToolSurface from '@/components/layout/LightToolSurface'
import AntibioGuideApp from '@/components/antibio/AntibioGuideApp'

/**
 * AntibioGuide · reco HAS — outil de la Boîte à outils.
 * Pas de DesktopOnly : l'outil est conçu pour le fauteuil et le mobile
 * (décision Julie, 15/10/2026).
 */
export default function AntibioGuidePage() {
  return (
    <LightToolSurface>
      <AntibioGuideApp />
    </LightToolSurface>
  )
}
