'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import BottomNav from '@/components/layout/BottomNav'
import SideNav from '@/components/layout/SideNav'
import PWAInstallBanner from '@/components/PWAInstallBanner'
import MiniPlayer from '@/components/MiniPlayer'
import AudioQueuePlayer from '@/components/news/AudioQueuePlayer'
import { useUser } from '@/lib/hooks/useUser'
import { FocusModeProvider } from '@/context/FocusModeContext'
import { MiniPlayerVisibilityProvider } from '@/context/MiniPlayerVisibilityContext'
import { NotificationOrchestratorProvider } from '@/context/NotificationOrchestratorContext'

interface AppShellProps {
  children: React.ReactNode
}

// Segments rendus plein écran (sans bottom nav ni chrome audio/PWA).
// L'onboarding « centres d'intérêt » doit s'afficher sans navigation pour
// rester focalisé (cf. PR2a). La nav vit dans (app)/layout.tsx ; on la
// neutralise ici en fonction du pathname plutôt qu'au niveau d'un layout
// imbriqué (impossible de retirer le chrome parent en App Router).
const FULLSCREEN_SEGMENTS = ['/onboarding']

export default function AppShell({
  children,
}: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  // Source UNIQUE d'`interests` (store partagé useUser), identique à celle lue
  // par /onboarding → plus de divergence cache vs refetch (cf. PR2b-fix).
  const { profile, loading } = useUser()
  const redirectGuardRef = useRef(false)

  // Gating onboarding (PR2b, Tâche B ; durci PR2b-fix Tâche 1) : la redirection
  // d'auth/callback ne couvre que le 1er signup ; un login classique d'un user
  // `interests IS NULL` ne passait pas par /onboarding. On complète ici, côté
  // chrome global. auth/callback reste en place (les deux coexistent).
  //
  // Idempotence : on ne déclenche `router.replace` qu'une fois par « besoin »
  // (ref one-shot, ré-armée dès qu'on n'a plus besoin de rediriger ou qu'on est
  // déjà sur /onboarding). Combiné à la mise à jour optimiste d'`interests`
  // après skip/continue, cela rend le ping-pong /↔/onboarding impossible.
  useEffect(() => {
    if (loading) return
    const needsOnboarding = !!profile && profile.interests === null
    if (needsOnboarding && pathname !== '/onboarding') {
      if (!redirectGuardRef.current) {
        redirectGuardRef.current = true
        router.replace('/onboarding')
      }
    } else {
      redirectGuardRef.current = false
    }
  }, [loading, profile, pathname, router])

  const isFullscreen = FULLSCREEN_SEGMENTS.some(
    (seg) => pathname === seg || pathname?.startsWith(`${seg}/`)
  )

  // Le provider push enveloppe les DEUX branches (plein écran et normal) : une
  // seule instance (donc une seule registration SW + un seul fetch prefs) reste
  // stable au travers du toggle fullscreen⇄normal. Il se charge lui-même de
  // masquer le soft-ask sur les segments plein écran.
  const inner = isFullscreen ? (
    <div className="min-h-screen" style={{ background: '#0F0F0F' }}>
      {children}
    </div>
  ) : (
    <FocusModeProvider>
      {/* Sous lg : DOM/rendu identique a avant (pb-28 pour la pilule mobile).
          A partir de lg : la SideNav fixe occupe la colonne de gauche (w-64) et
          le contenu est decale via lg:pl-64. La SideNav se rend d'elle-meme en
          hidden lg:flex, donc invisible sous lg. */}
      <div className="min-h-screen pb-28 lg:pl-64" style={{ background: '#0F0F0F' }}>
        <SideNav />
        {children}
        <PWAInstallBanner />
        <MiniPlayer />
        <AudioQueuePlayer />
        <BottomNav />
      </div>
    </FocusModeProvider>
  )

  return (
    <NotificationOrchestratorProvider>
      <MiniPlayerVisibilityProvider>{inner}</MiniPlayerVisibilityProvider>
    </NotificationOrchestratorProvider>
  )
}
