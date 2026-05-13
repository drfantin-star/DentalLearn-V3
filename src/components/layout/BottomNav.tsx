'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Newspaper,
  UserCircle,
  ShieldCheck,
  Briefcase,
  Shield,
  Presentation,
  type LucideIcon,
} from 'lucide-react'
import type { IntraRole } from '@/lib/auth/rbac'

interface NavTab {
  href: string
  icon: LucideIcon
  label: string
}

const BASE_TABS: NavTab[] = [
  { href: '/', icon: Home, label: 'Accueil' },
  { href: '/news', icon: Newspaper, label: 'Actus' },
  { href: '/profil', icon: UserCircle, label: 'Profil' },
  { href: '/conformite', icon: ShieldCheck, label: 'Conformité' },
]

const TENANT_ADMIN_ROLES: ReadonlySet<IntraRole> = new Set<IntraRole>([
  'titulaire',
  'admin_rh',
  'admin_of',
])

interface BottomNavProps {
  intraRole?: IntraRole | null
  isSuperAdmin?: boolean
  isFormateur?: boolean
}

export default function BottomNav({
  intraRole = null,
  isSuperAdmin = false,
  isFormateur = false,
}: BottomNavProps) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  // Ne pas afficher la nav sur les pages auth
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password')
  ) {
    return null
  }

  const tabs: NavTab[] = [...BASE_TABS]
  // 5e onglet contextuel — priorité mutuellement exclusive pour garder la
  // BottomNav à 5 onglets max (lisibilité mobile). Le rôle le plus large
  // gagne : un super_admin formateur voit "Admin" et accède à /formateur
  // via la carte du profil.
  const contextualTab: NavTab | null = isSuperAdmin
    ? { href: '/admin', icon: Shield, label: 'Admin' }
    : isFormateur
      ? { href: '/formateur/dashboard', icon: Presentation, label: 'Formateur' }
      : intraRole && TENANT_ADMIN_ROLES.has(intraRole)
        ? { href: '/tenant/admin', icon: Briefcase, label: 'Mon cabinet' }
        : null

  if (contextualTab) {
    // Inséré en avant-dernier (avant Conformité) pour rester proche de Profil.
    tabs.splice(3, 0, contextualTab)
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 px-2 py-2 z-40 safe-bottom"
      style={{ background: '#1a1a1a', borderTop: '0.5px solid #2a2a2a' }}
    >
      <div className="max-w-lg mx-auto flex justify-around">
        {tabs.map((tab) => {
          const active = isActive(tab.href)
          const Icon = tab.icon

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center px-2 py-1.5 rounded-xl transition-all ${
                active
                  ? 'bg-gradient-to-b from-[#2D1B96]/10 to-[#00D1C1]/10'
                  : 'hover:bg-gray-50'
              }`}
            >
              <Icon
                size={22}
                className={active ? 'text-[#2D1B96]' : 'text-[#6b7280]'}
                strokeWidth={active ? 2.5 : 2}
              />
              <span
                className={`text-[10px] mt-1 font-medium ${
                  active ? 'text-[#2D1B96]' : 'text-[#6b7280]'
                }`}
              >
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
