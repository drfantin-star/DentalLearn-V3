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
  Search,
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
  // « Shorts » = ex-onglet « Actus » : label seul renommé, route /news inchangée.
  { href: '/news', icon: Newspaper, label: 'Shorts' },
  // « Ma Certif » = ex-onglet « Profil » : route TEMPORAIRE /profil en attendant
  // la page dédiée /ma-certif (point suivant). Label seul renommé.
  { href: '/profil', icon: UserCircle, label: 'Ma Certif' },
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

  const searchActive = isActive('/recherche')

  // Style sombre translucide partagé pilule + bouton loupe (cohérent #0F0F0F app).
  const glassStyle = {
    background: 'rgba(26, 26, 26, 0.78)',
    border: '0.5px solid rgba(255, 255, 255, 0.10)',
  } as const

  return (
    // Barre flottante : le <nav> couvre toute la largeur mais ne capte pas les
    // clics (pointer-events-none) ; seuls la pilule et la loupe sont cliquables,
    // pour laisser passer les taps dans les marges autour de la barre.
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 safe-bottom pointer-events-none">
      <div className="max-w-lg mx-auto flex items-stretch gap-2.5">
        {/* Pilule flottante arrondie contenant les onglets */}
        <div
          className="pointer-events-auto flex-1 flex justify-around items-center px-1.5 py-2 rounded-[26px] backdrop-blur-xl shadow-2xl"
          style={glassStyle}
        >
          {tabs.map((tab) => {
            const active = isActive(tab.href)
            const Icon = tab.icon

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center px-2 py-1.5 rounded-2xl transition-all ${
                  active
                    ? 'bg-gradient-to-b from-primary/10 to-accent/10'
                    : 'hover:bg-white/5'
                }`}
              >
                <Icon
                  size={22}
                  className={active ? 'text-primary' : 'text-[#9ca3af]'}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span
                  className={`text-[10px] mt-1 font-medium ${
                    active ? 'text-primary' : 'text-[#9ca3af]'
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </div>

        {/* Bouton recherche : rond, détaché à droite de la pilule.
            Route /recherche (page créée ultérieurement). Icône seule → aria-label. */}
        <Link
          href="/recherche"
          aria-label="Recherche"
          className={`pointer-events-auto flex items-center justify-center aspect-square rounded-full backdrop-blur-xl shadow-2xl transition-all ${
            searchActive ? 'bg-gradient-to-b from-primary/10 to-accent/10' : ''
          }`}
          style={glassStyle}
        >
          <Search
            size={24}
            className={searchActive ? 'text-primary' : 'text-[#9ca3af]'}
            strokeWidth={2}
          />
        </Link>
      </div>
    </nav>
  )
}
