import AppShell from '@/components/layout/AppShell'
import SessionRecoveryGuard from '@/components/SessionRecoveryGuard'
import { AudioProvider } from '@/context/AudioContext'
import { AudioPlayerProvider } from '@/context/AudioPlayerContext'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserIntraRole, isFormateur, isSuperAdmin } from '@/lib/auth/rbac'

// Guard d'auth sur tout le route group (app). Les users orgless restent
// autorisés (le 5e onglet BottomNav reste gaté par superAdminFlag/formateurFlag
// plus bas), seuls les visiteurs non authentifiés sont redirigés vers /login.

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

  const [intraRole, superAdminFlag, formateurFlag] = user
    ? await Promise.all([
        getUserIntraRole(user.id),
        isSuperAdmin(user.id),
        isFormateur(user.id),
      ])
    : [null, false, false]

  return (
    <AudioProvider>
      <AudioPlayerProvider>
        <SessionRecoveryGuard />
        <AppShell
          intraRole={intraRole}
          isSuperAdmin={superAdminFlag}
          isFormateur={formateurFlag}
        >
          {children}
        </AppShell>
      </AudioPlayerProvider>
    </AudioProvider>
  )
}
