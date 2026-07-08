import AppShell from '@/components/layout/AppShell'
import SessionRecoveryGuard from '@/components/SessionRecoveryGuard'
import { AudioProvider } from '@/context/AudioContext'
import { AudioPlayerProvider } from '@/context/AudioPlayerContext'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Guard d'auth sur tout le route group (app). Les users orgless restent
// autorisés ; seuls les visiteurs non authentifiés sont redirigés vers /login.
// Les rôles ne sont plus calculés ici : la BottomNav n'a plus d'onglet
// contextuel et la page Profil lit ses rôles via /api/user/intra-role.

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Guard d'authentification : redirige vers /login si pas de session.
  // Couvre toutes les pages du route group (app) : /, /sante, /news, /profil,
  // /patient, /conformite, /formation. Les routes publiques (/login, /register,
  // /forgot-password, /reset-password, /verify-email, /verify/[code],
  // /reclamation, /auth/callback) sont hors de ce route group et restent ouvertes.
  if (!user) {
    redirect('/login')
  }

  return (
    <AudioProvider>
      <AudioPlayerProvider>
        <SessionRecoveryGuard />
        <AppShell>
          {children}
        </AppShell>
      </AudioPlayerProvider>
    </AudioProvider>
  )
}
