'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Users,
  Palette,
  BookMarked,
  LogOut,
} from 'lucide-react'
import type { OrgType } from '@/lib/auth/rbac'

interface TenantShellProps {
  org: {
    id: string
    name: string
    type: OrgType
    plan: string
    branding_logo_url: string | null
    branding_primary_color: string | null
  }
  children: React.ReactNode
}

const DEFAULT_PRIMARY = '#2D1B96'

export default function TenantShell({ org, children }: TenantShellProps) {
  const pathname = usePathname()
  const router = useRouter()

  const showBrandedExtras = org.type === 'hr_entity' || org.type === 'training_org'
  const primaryColor = (showBrandedExtras && org.branding_primary_color) || DEFAULT_PRIMARY

  const logoNode = useMemo(() => {
    if (showBrandedExtras && org.branding_logo_url) {
      return (
        <img
          src={org.branding_logo_url}
          alt={org.name}
          className="h-10 w-auto max-w-[180px] object-contain"
        />
      )
    }
    return (
      <div>
        <h1 className="text-xl font-bold leading-none">DentalLearn</h1>
        <p className="text-xs text-white/70 mt-1">Espace tenant</p>
      </div>
    )
  }, [showBrandedExtras, org.branding_logo_url, org.name])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems: Array<{ href: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { href: '/tenant/admin', label: 'Tableau de bord', icon: LayoutDashboard },
    { href: '/tenant/admin/members', label: 'Membres', icon: Users },
  ]
  if (showBrandedExtras) {
    navItems.push({ href: '/tenant/admin/branding', label: 'Personnalisation', icon: Palette })
    navItems.push({ href: '/tenant/admin/curation', label: 'Catalogue', icon: BookMarked })
  }

  const isActive = (href: string) => {
    if (href === '/tenant/admin') return pathname === '/tenant/admin'
    return pathname?.startsWith(href)
  }

  return (
    <div
      className="min-h-screen bg-gray-100 flex"
      style={{ ['--tenant-primary' as string]: primaryColor } as React.CSSProperties}
    >
      <aside
        className="w-64 text-white flex flex-col"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="p-6 border-b border-white/10 min-h-[88px] flex items-center">
          {logoNode}
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const active = isActive(item.href)
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                      active ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors w-full text-left"
          >
            <LogOut className="w-5 h-5" />
            Déconnexion
          </button>
          <p className="text-[11px] text-white/60 text-center">
            Powered by DentalLearn
          </p>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
