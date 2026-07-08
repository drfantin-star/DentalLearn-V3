'use client'

import React, { createContext, useContext, useState } from 'react'

interface FocusModeContextValue {
  isFocus: boolean
  setFocus: (v: boolean) => void
}

const FocusModeContext = createContext<FocusModeContextValue | null>(null)

export function FocusModeProvider({ children }: { children: React.ReactNode }) {
  const [isFocus, setFocus] = useState(false)

  return (
    <FocusModeContext.Provider value={{ isFocus, setFocus }}>
      {children}
    </FocusModeContext.Provider>
  )
}

export function useFocusMode() {
  const ctx = useContext(FocusModeContext)
  if (!ctx) throw new Error('useFocusMode must be used within FocusModeProvider')
  return ctx
}
