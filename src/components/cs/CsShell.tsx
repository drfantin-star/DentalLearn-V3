'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ClipboardCheck,
  History,
  LogOut,
  Menu,
  X,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react'

const NAV_ITEMS: Array<{
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { href: '/cs', label: "File d'attente", icon: ClipboardCheck },
  { href: '/cs/historique', label: 'Mes validations', icon: History },
]

export default function CsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  // `/cs` ne doit pas rester actif sur les sous-routes (validation,
  // historique) : correspondance exacte, sauf pour l'historique.
  const isActive = (href: string) =>
    href === '/cs' ? pathname === '/cs' : pathname?.startsWith(href)

  const sidebarContent = (
    <>
      <div className="p-6 border-b border-white/10 min-h-[88px] flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold leading-none">Certily</h1>
          <p className="text-xs text-white/70 mt-1">Comité Scientifique</p>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-2 -mr-2 rounded-lg hover:bg-white/10"
          aria-label="Fermer la navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                    active ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="flex-1">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-white/10 space-y-2">
        <Link
          href="/"
          className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors w-full text-left text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à la plateforme
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors w-full text-left"
        >
          <LogOut className="w-5 h-5" />
          Déconnexion
        </button>
        <p className="text-[11px] text-white/60 text-center pt-1">
          Certily · Comité Scientifique
        </p>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-gray-100" style={{ colorScheme: 'light' }}>
      {/* Mobile top bar (l'espace reste desktop-only via DesktopOnly, mais on
          garde une barre cohérente pour les tailles intermédiaires) */}
      <header className="lg:hidden sticky top-0 z-30 bg-primary text-white flex items-center justify-between px-4 py-3 shadow-md">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 rounded-lg hover:bg-white/10"
          aria-label="Ouvrir la navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold">Comité Scientifique</h1>
        <Link
          href="/"
          className="p-2 -mr-2 rounded-lg hover:bg-white/10 text-xs"
          aria-label="Retour à la plateforme"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
      </header>

      <div className="flex">
        <aside className="hidden lg:flex w-64 bg-primary text-white flex-col min-h-screen sticky top-0">
          {sidebarContent}
        </aside>

        {mobileOpen && (
          <>
            <div
              className="lg:hidden fixed inset-0 bg-black/50 z-40"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <aside className="lg:hidden fixed top-0 left-0 bottom-0 w-72 bg-primary text-white flex flex-col z-50 shadow-2xl">
              {sidebarContent}
            </aside>
          </>
        )}

        <main className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto px-6 py-8">
            <div className="flex items-center gap-2 text-primary mb-6">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-sm font-semibold uppercase tracking-wide">
                Validation éditoriale
              </span>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
