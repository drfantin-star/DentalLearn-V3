'use client'

// Bandeau discret « cet appareil n'est pas abonné » — home uniquement, mobile
// uniquement. Rattrape le scénario PC → mobile : la préférence de compte dit
// oui (notifications_enabled), mais cet appareil n'a jamais été abonné.
//
// Gate : canPush && !subscribed && notifications_enabled === true &&
//        softask_dismissed_count >= 2 && isMobileSurface.
// Composant auto-gaté : à monter sans condition côté page.

import { useState } from 'react'
import { Bell, Loader2 } from 'lucide-react'
import { useNotificationOrchestrator } from '@/context/NotificationOrchestratorContext'

export default function HomeDevicePushBanner() {
  const {
    canPush,
    subscribed,
    isMobileSurface,
    prefs,
    subscribe,
  } = useNotificationOrchestrator()

  const [busy, setBusy] = useState(false)

  const visible =
    canPush &&
    !subscribed &&
    isMobileSurface &&
    prefs !== null &&
    prefs.notifications_enabled === true &&
    prefs.softask_dismissed_count >= 2

  if (!visible) return null

  const handleActivate = async () => {
    setBusy(true)
    await subscribe()
    setBusy(false)
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <Bell className="h-4 w-4 shrink-0 text-white/50" />
      <p className="flex-1 text-xs text-white/70">
        Les notifications ne sont pas actives sur cet appareil.
      </p>
      <button
        type="button"
        onClick={() => { void handleActivate() }}
        disabled={busy}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-black transition active:scale-[0.99] disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Activer'}
      </button>
    </div>
  )
}
