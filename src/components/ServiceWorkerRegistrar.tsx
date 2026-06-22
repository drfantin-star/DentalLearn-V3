'use client'

import { useEffect } from 'react'

// Enregistre le service worker (`/sw.js`) au boot de l'app, indépendamment des
// push. Chrome n'expose le bouton d'install PWA natif (`beforeinstallprompt`)
// que si un SW est enregistré : sans cet enregistrement précoce, l'install ne
// se déclenchait que pour les utilisateurs ayant ouvert le toggle push
// (`usePushNotifications`), laissant la plupart des testeurs Android sur le repli.
//
// `navigator.serviceWorker.register('/sw.js')` est idempotent (même URL + scope
// par défaut `/`) : l'appel coexiste sans conflit avec celui de
// `usePushNotifications`, qui réutilise simplement cette registration.
//
// Aucun localStorage / sessionStorage. Composant sans UI.
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').catch((err) => {
      // L'app doit fonctionner sans SW : on log sans throw.
      console.error('[SW] Registration error:', err)
    })
  }, [])

  return null
}
