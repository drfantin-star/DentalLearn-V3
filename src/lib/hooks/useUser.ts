'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { createClient, getUserWithTimeout } from '@/lib/supabase/client'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import type { UserInterests } from '@/lib/supabase/types'

// NB : type partiel divergent du UserProfile canonique de types.ts. Unification
// complète notée pour plus tard (cf. recap PR1) ; on expose ici a minima
// `interests` en lecture (fetch déjà en select('*')) pour « Pour vous ».
interface UserProfile {
  id: string
  first_name: string | null
  last_name: string | null
  profile_photo_url: string | null
  city: string | null
  practice_type: string | null
  interests: UserInterests | null
}

interface Streak {
  current_streak: number
  longest_streak: number
  last_activity_date: string | null
}

interface UserState {
  user: User | null
  profile: UserProfile | null
  streak: Streak | null
  loading: boolean
}

// ─────────────────────────────────────────────────────────────────────────
// Store partagé (singleton) — SOURCE UNIQUE de vérité pour `interests`.
//
// Avant : `useUser` était un hook à état local ; chaque appelant (AppShell,
// home, onboarding) avait sa propre copie. AppShell vit dans le layout
// persistant (app) et ne remonte pas entre navigations → son instance gardait
// `interests=null` en cache après un skip, pendant que l'onboarding relisait la
// vraie valeur en direct → boucle de redirection (PR2b-fix Tâche 1).
//
// Désormais l'état est un store module-level partagé : un `refetch`/`mutate`
// depuis n'importe quel consommateur mets à jour TOUS les abonnés. AppShell et
// onboarding lisent donc strictement la même valeur d'`interests`.
// ─────────────────────────────────────────────────────────────────────────

let state: UserState = { user: null, profile: null, streak: null, loading: true }
// Snapshot serveur stable (référence constante) pour useSyncExternalStore.
const SERVER_SNAPSHOT: UserState = {
  user: null,
  profile: null,
  streak: null,
  loading: true,
}
const listeners = new Set<() => void>()
let initialized = false
let inFlight: Promise<void> | null = null

function setState(patch: Partial<UserState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

async function fetchUser(): Promise<void> {
  // Déduplique les fetchs concurrents (montage simultané de plusieurs
  // consommateurs + refetch).
  if (inFlight) return inFlight
  inFlight = (async () => {
    const supabase = createClient()
    try {
      // Borné par timeout : garantit que `loading` finit toujours par passer à
      // false, même si l'auth se coince (jamais de spinner infini sur AppShell).
      const { user: authUser } = await getUserWithTimeout()

      if (!authUser) {
        setState({ user: null, profile: null, streak: null, loading: false })
        return
      }

      const [{ data: profileData }, { data: streakData }] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', authUser.id).single(),
        supabase
          .from('streaks')
          .select('current_streak, longest_streak, last_activity_date')
          .eq('user_id', authUser.id)
          .single(),
      ])

      setState({
        user: authUser,
        profile: (profileData as UserProfile) ?? null,
        streak: (streakData as Streak) ?? null,
        loading: false,
      })
    } catch (err) {
      console.error('Error fetching user:', err)
      setState({ loading: false })
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

function ensureInit() {
  if (initialized) return
  initialized = true
  void fetchUser()

  // Écouter les changements d'auth (une seule fois pour tout le store).
  const supabase = createClient()
  supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
    if (!session?.user) {
      setState({ user: null, profile: null, streak: null, loading: false })
    } else {
      void fetchUser()
    }
  })
}

function subscribe(cb: () => void): () => void {
  // Premier abonné → initialise le store (effet passif, hors render).
  ensureInit()
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function getSnapshot(): UserState {
  return state
}

function getServerSnapshot(): UserState {
  return SERVER_SNAPSHOT
}

// Mise à jour optimiste de `interests` dans le store partagé, à appeler AVANT
// de naviguer après un skip/continue : garantit qu'AppShell voit la valeur
// non-null immédiatement (pas de fenêtre de cache périmé → pas de loop).
export function setLocalInterests(interests: UserInterests | null) {
  if (!state.profile) return
  setState({ profile: { ...state.profile, interests } })
}

export function useUser() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const refetch = useCallback(() => fetchUser(), [])
  const mutateInterests = useCallback(
    (interests: UserInterests | null) => setLocalInterests(interests),
    []
  )

  const displayName = snap.profile?.first_name
    ? `Dr. ${snap.profile.first_name}`
    : snap.user?.email?.split('@')[0] || 'Utilisateur'

  return {
    user: snap.user,
    profile: snap.profile,
    streak: snap.streak,
    loading: snap.loading,
    displayName,
    isAuthenticated: !!snap.user,
    refetch,
    mutateInterests,
  }
}
