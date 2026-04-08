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
      <div className="min-h-screen bg-gray-50 pb-24">
        {children}
        <PWAInstallBanner />
        <MiniPlayer />
        <BottomNav />
      </div>
    </AudioProvider>
  )
}
