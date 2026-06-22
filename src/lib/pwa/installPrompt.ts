// Capture précoce de l'événement `beforeinstallprompt` (Android / Chrome).
//
// Chrome peut émettre `beforeinstallprompt` dès le premier paint, AVANT que
// PWAInstallBanner ne monte (le composant vit derrière le guard d'auth + le
// chargement async du profil dans AppShell). Si on attendait le `useEffect` du
// composant pour s'abonner, on raterait l'événement et le bouton d'install
// natif n'apparaîtrait jamais.
//
// On installe donc les listeners au niveau module, dès le premier import, et on
// mémorise le dernier event capturé. Le composant lit la valeur déjà capturée
// au montage ET s'abonne aux émissions suivantes.
//
// AUCUN localStorage / sessionStorage ici : état en mémoire uniquement.

// L'événement n'est pas typé dans la lib DOM standard.
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

type Subscriber = (event: BeforeInstallPromptEvent | null) => void

let deferredPrompt: BeforeInstallPromptEvent | null = null
const subscribers = new Set<Subscriber>()
let initialized = false

function notify() {
  for (const cb of subscribers) cb(deferredPrompt)
}

function ensureInit() {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  window.addEventListener('beforeinstallprompt', (e) => {
    // Empêche la mini-infobar Chrome par défaut : on pilote l'install nous-mêmes.
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    notify()
  })

  // Une fois l'app installée, l'event n'a plus de sens : on le purge et on
  // prévient les abonnés (le banner se masque).
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

// Déclenche la capture au tout premier import (côté client uniquement).
ensureInit()

/** Dernier `beforeinstallprompt` capturé, ou null si indisponible. */
export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt
}

/**
 * S'abonne aux changements (nouvel event capturé, ou purge après appinstalled).
 * Appelle immédiatement le callback avec la valeur courante, ce qui permet de
 * récupérer un event déjà capturé AVANT le montage du composant.
 * Retourne une fonction de désabonnement.
 */
export function subscribeInstallPrompt(cb: Subscriber): () => void {
  ensureInit()
  subscribers.add(cb)
  cb(deferredPrompt)
  return () => {
    subscribers.delete(cb)
  }
}

/**
 * Déclenche le dialogue natif d'installation. Retourne l'outcome, ou null si
 * aucun event n'est disponible. Consomme l'event (un `beforeinstallprompt` est
 * à usage unique).
 */
export async function triggerInstallPrompt(): Promise<
  'accepted' | 'dismissed' | null
> {
  if (!deferredPrompt) return null
  const evt = deferredPrompt
  await evt.prompt()
  const { outcome } = await evt.userChoice
  // À usage unique : on purge quoi qu'il arrive.
  deferredPrompt = null
  notify()
  return outcome
}
