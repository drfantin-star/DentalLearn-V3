'use client'

import React, { createContext, useContext, useState } from 'react'

// Contexte UI leger : permet a une page de masquer l'AFFICHAGE du mini-player
// flottant sur certaines vues, sans toucher a l'AudioContext (l'audio continue
// de tourner). Utilise par /formation/[theme] pour cacher le mini-player sur le
// detail formation + le quizz de sequence (P4), tout en le gardant visible sur
// la liste des formations du theme.

interface MiniPlayerVisibilityContextValue {
  suppressed: boolean
  setSuppressed: (v: boolean) => void
}

const MiniPlayerVisibilityContext = createContext<MiniPlayerVisibilityContextValue | null>(null)

// Reference stable pour le cas hors provider (ex. segments plein ecran) : evite
// de jeter et evite de changer d'identite a chaque render (deps d'effets sereines).
const NOOP_VALUE: MiniPlayerVisibilityContextValue = {
  suppressed: false,
  setSuppressed: () => {},
}

export function MiniPlayerVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [suppressed, setSuppressed] = useState(false)

  return (
    <MiniPlayerVisibilityContext.Provider value={{ suppressed, setSuppressed }}>
      {children}
    </MiniPlayerVisibilityContext.Provider>
  )
}

export function useMiniPlayerVisibility() {
  return useContext(MiniPlayerVisibilityContext) ?? NOOP_VALUE
}
