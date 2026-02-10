import BottomNav from '@/components/layout/BottomNav'
import PWAInstallBanner from '@/components/PWAInstallBanner'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {children}
      <PWAInstallBanner />
      <BottomNav />
    </div>
  )
}
