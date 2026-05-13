import BottomNav from '@/components/layout/BottomNav'
import PWAInstallBanner from '@/components/PWAInstallBanner'
import MiniPlayer from '@/components/MiniPlayer'
import AudioQueuePlayer from '@/components/news/AudioQueuePlayer'
import { AudioProvider } from '@/context/AudioContext'
import { AudioPlayerProvider } from '@/context/AudioPlayerContext'
import { createClient } from '@/lib/supabase/server'
import { getUserIntraRole, isFormateur, isSuperAdmin } from '@/lib/auth/rbac'

// Layout async : résout l'intra_role + flags rôles globaux (formateur,
// super_admin) côté serveur pour gater le 5e onglet contextuel du BottomNav.
// Pas de redirection ici — les pages restent accessibles aux users orgless ;
// seul l'onglet est masqué si l'user n'a aucun rôle élevé.

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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
        <div className="min-h-screen pb-24" style={{ background: '#0F0F0F' }}>
          {children}
          <PWAInstallBanner />
          <MiniPlayer />
          <AudioQueuePlayer />
          <BottomNav
            intraRole={intraRole}
            isSuperAdmin={superAdminFlag}
            isFormateur={formateurFlag}
          />
        </div>
      </AudioPlayerProvider>
    </AudioProvider>
  )
}
