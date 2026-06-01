'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import BottomNav from '@/components/layout/BottomNav'
import PWAInstallBanner from '@/components/PWAInstallBanner'
import MiniPlayer from '@/components/MiniPlayer'
import AudioQueuePlayer from '@/components/news/AudioQueuePlayer'
import { useUser } from '@/lib/hooks/useUser'
import type { IntraRole } from '@/lib/auth/rbac'

interface AppShellProps {
  children: React.ReactNode
  intraRole?: IntraRole | null
  isSuperAdmin?: boolean
  isFormateur?: boolean
}

// Segments rendus plein écran (sans bottom nav ni chrome audio/PWA).
// L'onboarding « centres d'intérêt » doit s'afficher sans navigation pour
// rester focalisé (cf. PR2a). La nav vit dans (app)/layout.tsx ; on la
// neutralise ici en fonction du pathname plutôt qu'au niveau d'un layout
// imbriqué (impossible de retirer le chrome parent en App Router).
const FULLSCREEN_SEGMENTS = ['/onboarding']

export default function AppShell({
  children,
  intraRole,
  isSuperAdmin,
  isFormateur,
}: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { profile, loading } = useUser()

  // Gating onboarding (PR2b, Tâche B) : la redirection d'auth/callback ne couvre
  // que le 1er signup ; un login classique d'un user `interests IS NULL` ne
  // passait jamais par /onboarding. On complète ici, côté chrome global, une
  // fois le profil chargé. auth/callback reste en place (les deux coexistent).
  useEffect(() => {
    if (loading) return
    if (profile && profile.interests === null && pathname !== '/onboarding') {
      router.replace('/onboarding')
    }
  }, [loading, profile, pathname, router])

  const isFullscreen = FULLSCREEN_SEGMENTS.some(
    (seg) => pathname === seg || pathname?.startsWith(`${seg}/`)
  )

  if (isFullscreen) {
    return (
      <div className="min-h-screen" style={{ background: '#0F0F0F' }}>
        {children}
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0F0F0F' }}>
      {children}
      <PWAInstallBanner />
      <MiniPlayer />
      <AudioQueuePlayer />
      <BottomNav
        intraRole={intraRole}
        isSuperAdmin={isSuperAdmin}
        isFormateur={isFormateur}
      />
    </div>
  )
}
