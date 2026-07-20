'use client'

// Prompt post-victoire : moment d'acceptation maximale (fin de séquence ou fin
// du quiz du jour). Bulle Sophie + prompt système. Composant AUTO-GATÉ : il
// lit le context et décide seul de s'afficher — le handler de complétion ne
// déclenche rien (pas de prop-drilling, race-free).
//
// Gate : canPush && !subscribed && isTouchDevice && softask_dismissed_count <= 1
// && !softAskOpen. Un refus ici (compteur → 2) coupe toute demande auto ultérieure.

import { useState } from 'react'
import { Bell, Loader2, X } from 'lucide-react'
import SophieAvatar from '@/components/sophie/SophieAvatar'
import { useNotificationOrchestrator } from '@/context/NotificationOrchestratorContext'

export default function PostVictoryPushPrompt() {
  const {
    canPush,
    subscribed,
    softAskOpen,
    isTouchDevice,
    prefs,
    subscribe,
    markDismissed,
  } = useNotificationOrchestrator()

  const [busy, setBusy] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // isTouchDevice : sans ce gate, le prompt s'afficherait sur desktop (où
  // canPush est vrai) — interdit (§4.6, le desktop ne demande jamais).
  const visible =
    !dismissed &&
    canPush &&
    !subscribed &&
    !softAskOpen &&
    isTouchDevice &&
    prefs !== null &&
    prefs.softask_dismissed_count <= 1

  if (!visible) return null

  const handleYes = async () => {
    setBusy(true)
    await subscribe()
    setBusy(false)
    setDismissed(true)
  }

  const handleNo = async () => {
    setBusy(true)
    await markDismissed()
    setBusy(false)
    setDismissed(true)
  }

  return (
    <div className="mt-6 w-full rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start gap-3">
        <SophieAvatar size={44} />
        <div className="flex-1">
          <p className="text-sm text-white/90">
            Bravo&nbsp;! Je te préviens pour la suite&nbsp;?
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => { void handleYes() }}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-black transition active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Bell className="h-4 w-4" /> Oui, préviens-moi
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => { void handleNo() }}
              disabled={busy}
              className="rounded-full px-3 py-2 text-sm text-white/50 transition hover:text-white/80 disabled:opacity-60"
            >
              Plus tard
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { void handleNo() }}
          disabled={busy}
          aria-label="Fermer"
          className="rounded-full p-1 text-white/40 transition hover:bg-white/10 hover:text-white/70"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
