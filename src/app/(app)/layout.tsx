import AppShell from '@/components/layout/AppShell'
import SessionRecoveryGuard from '@/components/SessionRecoveryGuard'
import AccountDeletionBlock from '@/components/AccountDeletionBlock'
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

  // Ecran bloquant si une demande de suppression est en attente. Lecture d'une
  // seule colonne, indexee par PK (id), ajoutee ici car le layout ne faisait
  // qu'un getUser(). La reconnexion remet deletion_requested_at a NULL via la
  // reactivation : c'est le garde-fou du praticien qui se ravise.
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('deletion_requested_at')
    .eq('id', user.id)
    .single()

  if (profile?.deletion_requested_at) {
    return <AccountDeletionBlock deletionRequestedAt={profile.deletion_requested_at} />
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
