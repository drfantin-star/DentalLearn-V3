'use client'

// Provider UNIQUE pour l'orchestration push multi-appareils.
//
// Pourquoi un provider et pas des instances usePushNotifications multiples :
// le hook enregistre /sw.js et lit getSubscription() dans un useEffect([]) par
// instance. Plusieurs surfaces (soft-ask, prompt post-victoire, bandeau home,
// /profil) = autant d'états `isSubscribed` divergents. Ici : UNE registration
// SW, UN fetch de préférences, UNE source de vérité contre laquelle toutes les
// surfaces se re-rendent.
//
// Persistance : base uniquement (localStorage/sessionStorage interdits). Le
// `isMobileSurface` passe par matchMedia, jamais par du storage.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { usePathname } from 'next/navigation'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { createClient } from '@/lib/supabase/client'
import { canRequestPush, isTouchDevice } from '@/lib/push/capability'
import SoftAskOverlay from '@/components/push/SoftAskOverlay'

// Segments plein écran où le soft-ask ne doit pas s'afficher (cf. AppShell).
const FULLSCREEN_SEGMENTS = ['/onboarding']

export interface OrchestratorPrefs {
  notifications_enabled: boolean
  softask_shown_at: string | null
  softask_dismissed_count: number
}

interface NotificationOrchestratorValue {
  canPush: boolean
  isMobileSurface: boolean
  isTouchDevice: boolean
  isSupported: boolean
  permission: 'prompt' | 'granted' | 'denied' | 'unsupported'
  subscribed: boolean
  isLoading: boolean
  prefs: OrchestratorPrefs | null
  softAskOpen: boolean
  subscribe: () => Promise<boolean>
  unsubscribe: () => Promise<boolean>
  markSoftAskShown: () => Promise<void>
  markDismissed: () => Promise<void>
  closeSoftAsk: () => void
  refresh: () => Promise<void>
}

const NotificationOrchestratorContext =
  createContext<NotificationOrchestratorValue | null>(null)

export function NotificationOrchestratorProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const pathname = usePathname()
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe: hookSubscribe,
    unsubscribe: hookUnsubscribe,
  } = usePushNotifications()

  const [userId, setUserId] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<OrchestratorPrefs | null>(null)
  const [canPush, setCanPush] = useState(false)
  const [isMobileSurface, setIsMobileSurface] = useState(false)
  const [touchDevice, setTouchDevice] = useState(false)
  const [softAskOpen, setSoftAskOpen] = useState(false)

  const isFullscreenRoute = FULLSCREEN_SEGMENTS.some(
    (seg) => pathname === seg || pathname?.startsWith(`${seg}/`),
  )

  // Capacité : recalculée au montage et à chaque changement de permission
  // (subscribe() bascule permission → il faut réévaluer).
  useEffect(() => {
    setCanPush(canRequestPush())
  }, [permission, isSupported])

  // Surface (mobile vs desktop) via matchMedia, réactif : réservé à l'AFFICHAGE
  // (QrAppCard desktop-only, bascule onboarding). PAS le gate des surfaces push.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(max-width: 1023px)')
    const apply = () => setIsMobileSurface(mql.matches)
    apply()
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [])

  // Appareil tactile (mobile OU tablette) : LE gate des surfaces push. Stable
  // sur la session, calculé une fois.
  useEffect(() => {
    setTouchDevice(isTouchDevice())
  }, [])

  const fetchPrefs = useCallback(
    async (uid: string) => {
      const { data } = await supabase
        .from('user_notification_preferences')
        .select(
          'notifications_enabled, softask_shown_at, softask_dismissed_count',
        )
        .eq('user_id', uid)
        .maybeSingle()
      setPrefs({
        notifications_enabled: data?.notifications_enabled ?? true,
        softask_shown_at: data?.softask_shown_at ?? null,
        softask_dismissed_count: data?.softask_dismissed_count ?? 0,
      })
    },
    [supabase],
  )

  useEffect(() => {
    let active = true
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!active || !user) return
      setUserId(user.id)
      await fetchPrefs(user.id)
    }
    load()
    return () => {
      active = false
    }
  }, [supabase, fetchPrefs])

  const refresh = useCallback(async () => {
    if (userId) await fetchPrefs(userId)
  }, [userId, fetchPrefs])

  // Ouverture du soft-ask : décidée UNE fois quand les conditions sont réunies.
  // Découplée de `softask_shown_at` : marquer « vu » ne doit pas refermer
  // l'overlay dans la même session (sinon il disparaît avant toute action).
  const softAskArmedRef = useRef(false)
  useEffect(() => {
    if (softAskArmedRef.current) return
    if (!prefs) return
    if (isLoading) return
    if (isFullscreenRoute) return
    if (!canPush || isSubscribed || !touchDevice) return
    if (prefs.softask_shown_at !== null) return
    softAskArmedRef.current = true
    setSoftAskOpen(true)
  }, [
    prefs,
    isLoading,
    isFullscreenRoute,
    canPush,
    isSubscribed,
    touchDevice,
  ])

  // Persistance « soft-ask affiché » — idempotente, une seule écriture.
  const shownWriteRef = useRef(false)
  const markSoftAskShown = useCallback(async () => {
    if (shownWriteRef.current) return
    if (!userId) return
    if (prefs?.softask_shown_at) return
    shownWriteRef.current = true
    const now = new Date().toISOString()
    setPrefs((p) => (p ? { ...p, softask_shown_at: now } : p))
    await supabase
      .from('user_notification_preferences')
      .upsert(
        { user_id: userId, softask_shown_at: now },
        { onConflict: 'user_id' },
      )
  }, [supabase, userId, prefs])

  // Incrément « Plus tard » — sérialisé (in-flight ref) contre les lost-updates.
  const dismissInFlightRef = useRef(false)
  const markDismissed = useCallback(async () => {
    if (dismissInFlightRef.current) return
    if (!userId) return
    dismissInFlightRef.current = true
    try {
      const next = (prefs?.softask_dismissed_count ?? 0) + 1
      setPrefs((p) => (p ? { ...p, softask_dismissed_count: next } : p))
      await supabase
        .from('user_notification_preferences')
        .upsert(
          { user_id: userId, softask_dismissed_count: next },
          { onConflict: 'user_id' },
        )
    } finally {
      dismissInFlightRef.current = false
    }
  }, [supabase, userId, prefs])

  const closeSoftAsk = useCallback(() => setSoftAskOpen(false), [])

  const subscribe = useCallback(async () => {
    const ok = await hookSubscribe()
    // subscribe() fait basculer permission → canPush est réévalué par l'effet.
    return ok
  }, [hookSubscribe])

  const value: NotificationOrchestratorValue = {
    canPush,
    isMobileSurface,
    isTouchDevice: touchDevice,
    isSupported,
    permission,
    subscribed: isSubscribed,
    isLoading,
    prefs,
    softAskOpen,
    subscribe,
    unsubscribe: hookUnsubscribe,
    markSoftAskShown,
    markDismissed,
    closeSoftAsk,
    refresh,
  }

  return (
    <NotificationOrchestratorContext.Provider value={value}>
      {children}
      {softAskOpen && !isFullscreenRoute && <SoftAskOverlay />}
    </NotificationOrchestratorContext.Provider>
  )
}

export function useNotificationOrchestrator(): NotificationOrchestratorValue {
  const ctx = useContext(NotificationOrchestratorContext)
  if (!ctx)
    throw new Error(
      'useNotificationOrchestrator must be used within NotificationOrchestratorProvider',
    )
  return ctx
}
