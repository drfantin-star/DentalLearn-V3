'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Newspaper,
  UserCircle,
  ShieldCheck,
  Search,
  type LucideIcon,
} from 'lucide-react'
import { useFocusMode } from '@/context/FocusModeContext'

interface NavTab {
  href: string
  icon: LucideIcon
  label: string
}

const BASE_TABS: NavTab[] = [
  { href: '/', icon: Home, label: 'Accueil' },
  // « Shorts » = ex-onglet « Actus » : label seul renommé, route /news inchangée.
  { href: '/news', icon: Newspaper, label: 'Shorts' },
  { href: '/ma-certif', icon: UserCircle, label: 'Ma Certif' },
  { href: '/conformite', icon: ShieldCheck, label: 'Conformité' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { isFocus } = useFocusMode()

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

  // Onglets identiques pour tous les utilisateurs. L'ancien 5e onglet
  // contextuel (Admin / Formateur / Mon cabinet) a migré vers la section
  // "Mes espaces" de la page Profil.
  const tabs: NavTab[] = [...BASE_TABS]

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
    <nav className={`fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 safe-bottom pointer-events-none ${isFocus ? 'hidden md:block' : ''}`}>
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
                    ? 'bg-accent/30'
                    : 'hover:bg-white/5'
                }`}
              >
                <Icon
                  size={22}
                  className={active ? 'text-white' : 'text-white/70'}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span
                  className={`text-[10px] mt-1 font-medium ${
                    active ? 'text-white' : 'text-white/70'
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
            searchActive ? 'bg-accent/30' : ''
          }`}
          style={glassStyle}
        >
          <Search
            size={24}
            className="text-white"
            strokeWidth={2}
          />
        </Link>
      </div>
    </nav>
  )
}
