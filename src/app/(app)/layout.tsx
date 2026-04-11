import BottomNav from '@/components/layout/BottomNav'
import PWAInstallBanner from '@/components/PWAInstallBanner'
import MiniPlayer from '@/components/MiniPlayer'
import { AudioProvider } from '@/context/AudioContext'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AudioProvider>
      <div className="min-h-screen pb-24" style={{ background: '#0F0F0F' }}>
        {children}
        <PWAInstallBanner />
        <MiniPlayer />
        <BottomNav />
      </div>
    </AudioProvider>
  )
}
