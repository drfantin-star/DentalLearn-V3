'use client'

// Soft-ask plein écran, affiché UNE seule fois par appareil (piloté par
// softask_shown_at en base). Rendu par le provider quand les conditions sont
// réunies (canPush && !subscribed && softask_shown_at IS NULL && isTouchDevice).
//
// « Oui » → prompt système + abonnement (flux existant). « Plus tard » →
// softask_dismissed_count += 1. Dans les deux cas softask_shown_at = now().

import { useEffect, useRef, useState } from 'react'
import { Bell, Loader2 } from 'lucide-react'
import SophieAvatar from '@/components/sophie/SophieAvatar'
import { useNotificationOrchestrator } from '@/context/NotificationOrchestratorContext'

export default function SoftAskOverlay() {
  const { subscribe, markSoftAskShown, markDismissed, closeSoftAsk } =
    useNotificationOrchestrator()
  const [busy, setBusy] = useState(false)

  // Marque « vu » au montage, une seule fois (idempotent côté provider).
  const shownRef = useRef(false)
  useEffect(() => {
    if (shownRef.current) return
    shownRef.current = true
    void markSoftAskShown()
  }, [markSoftAskShown])

  const handleYes = async () => {
    setBusy(true)
    await subscribe()
    setBusy(false)
    closeSoftAsk()
  }

  const handleLater = async () => {
    setBusy(true)
    await markDismissed()
    setBusy(false)
    closeSoftAsk()
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 px-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Activer les notifications"
    >
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex justify-center">
          <SophieAvatar size={96} />
        </div>

        <h2 className="mb-3 text-2xl font-bold text-white">Ne rate rien.</h2>
        <p className="mb-8 text-sm leading-relaxed text-white/70">
          Rappels de certification, nouvelles formations, sessions en direct.
        </p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => { void handleYes() }}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-base font-semibold text-black transition active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Bell className="h-5 w-5" /> Oui, préviens-moi
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => { void handleLater() }}
            disabled={busy}
            className="w-full text-center text-sm text-white/50 transition hover:text-white/80 disabled:opacity-60"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  )
}
