// Détection de plateforme et de capacité push.
//
// Le mode standalone n'est une contrainte QUE sur iOS : ailleurs (Android,
// desktop), le push fonctionne dans un onglet normal. Le gate correct pour
// afficher un CTA « activer les notifications » est donc la CAPACITÉ
// (`canRequestPush`), jamais le mode d'affichage.
//
// Module pur : pas de React, pas de localStorage/sessionStorage.

export function isIOS(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  // iPadOS 13+ se déclare comme un Mac : on discrimine sur le tactile.
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

// Appareil tactile (mobile OU tablette). C'est le bon gate pour les surfaces
// push : contrairement à une media-query de largeur, il n'exclut pas l'iPad
// PWA en paysage (1024px), pourtant parfaitement capable de recevoir des push.
// Valeur stable sur la session → aucune réactivité nécessaire.
// Limite assumée : un laptop Windows tactile passera vrai (cas marginal accepté,
// pas de détection d'OS pour ne pas complexifier).
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return navigator.maxTouchPoints > 0
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari n'implémente pas display-mode, propriété propriétaire.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

// LE gate à utiliser partout : cet appareil peut-il recevoir un push maintenant ?
export function canRequestPush(): boolean {
  if (typeof window === 'undefined') return false
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  if (!('Notification' in window)) return false
  // Refus définitif : le prompt système ne réapparaîtra jamais.
  if (Notification.permission === 'denied') return false
  // Seule contrainte propre à iOS : installation obligatoire.
  if (isIOS() && !isStandalone()) return false
  return true
}

// Source de vérité locale de l'abonnement de CET appareil (évite un aller-retour
// réseau vers push_subscriptions).
export async function isDeviceSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  const reg = await navigator.serviceWorker.ready
  return (await reg.pushManager.getSubscription()) !== null
}
