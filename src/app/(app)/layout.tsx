import BottomNav from '@/components/layout/BottomNav'
import PWAInstallBanner from '@/components/PWAInstallBanner'
import MiniPlayer from '@/components/MiniPlayer'
import AudioQueuePlayer from '@/components/news/AudioQueuePlayer'
import { AudioProvider } from '@/context/AudioContext'
import { AudioPlayerProvider } from '@/context/AudioPlayerContext'
import { createClient } from '@/lib/supabase/server'
import { getUserIntraRole } from '@/lib/auth/rbac'

// Layout async : résout l'intra_role côté serveur pour gater l'onglet
// "Mon cabinet" du BottomNav. Pas de redirection ici — les pages restent
// accessibles aux users orgless ; seul l'onglet est masqué si l'user n'est
// pas titulaire / admin_rh / admin_of.

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const intraRole = user ? await getUserIntraRole(user.id) : null

  return (
    <AudioProvider>
      <AudioPlayerProvider>
        <div className="min-h-screen pb-24" style={{ background: '#0F0F0F' }}>
          {children}
          <PWAInstallBanner />
          <MiniPlayer />
          <AudioQueuePlayer />
          <BottomNav intraRole={intraRole} />
        </div>
      </AudioPlayerProvider>
    </AudioProvider>
  )
}
