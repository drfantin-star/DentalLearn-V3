'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Newspaper,
  UserCircle,
  ShieldCheck,
  GraduationCap,
  Users,
  Heart,
  Shield,
  Presentation,
  Briefcase,
  type LucideIcon,
} from 'lucide-react'
import { useUser } from '@/lib/hooks/useUser'
import { useLeaderboard } from '@/lib/hooks/useLeaderboard'
import type { IntraRole } from '@/lib/auth/rbac'

interface NavItem {
  href: string
  icon: LucideIcon
  label: string
}

// Memes routes que la BottomNav (loupe /recherche incluse), reprises telles
// quelles. Ici Recherche est une entree de nav a part entiere (pas un bouton
// detache comme sur mobile).
const NAV_ITEMS: NavItem[] = [
  { href: '/', icon: Home, label: 'Accueil' },
  // « Shorts » = route /news (label seul, cf. BottomNav).
  { href: '/news', icon: Newspaper, label: 'Shorts' },
  { href: '/ma-certif', icon: UserCircle, label: 'Ma Certif' },
  { href: '/conformite', icon: ShieldCheck, label: 'Conformité' },
  // Acces direct aux 3 espaces (memes libelles que les cartes "Explorer" de
  // la home, cf. components/home/ExploreRow.tsx). Ces liens remplacent la
  // section "Explorer" de la home sur desktop (masquee en lg).
  { href: '/formation', icon: GraduationCap, label: 'Formations & EPP' },
  { href: '/patient', icon: Users, label: 'Relation patient' },
  { href: '/sante', icon: Heart, label: 'Santé personnelle' },
]

// Memes conditions que la page Profil (cf. src/app/(app)/profil/page.tsx) : un
// intra_role de cette liste ouvre l'espace cabinet /tenant/admin.
const TENANT_ADMIN_ROLES: ReadonlySet<IntraRole> = new Set<IntraRole>([
  'titulaire',
  'admin_rh',
  'admin_of',
])

export default function SideNav() {
  const pathname = usePathname()
  // Memes hooks que le header de la home : store partage useUser + leaderboard
  // lifetime. Aucun nouveau fetch bespoke n'est cree.
  const { user, profile, streak } = useUser()
  const { userRank: lifetimeRank } = useLeaderboard(user?.id, 'lifetime')

  // Roles / espaces — meme source que la page Profil (/api/user/intra-role).
  // On ne recree aucune logique de role ici.
  const [intraRole, setIntraRole] = useState<IntraRole | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [isFormateur, setIsFormateur] = useState(false)

  useEffect(() => {
    let active = true
    async function loadRoles() {
      try {
        const res = await fetch('/api/user/intra-role')
        if (!res.ok || !active) return
        const json = await res.json()
        setIntraRole((json.intra_role as IntraRole | null) ?? null)
        setIsSuperAdmin(Boolean(json.is_super_admin))
        setIsFormateur(Boolean(json.is_formateur))
      } catch {
        // Fail silencieux : espaces masques si indisponible (idem Profil).
      }
    }
    loadRoles()
    return () => {
      active = false
    }
  }, [])

  // Meme logique isActive que la BottomNav (exact sur '/', startsWith sinon).
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  // Meme garde que la BottomNav : pas de nav sur les pages auth.
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password')
  ) {
    return null
  }

  const showTenantLink = !!intraRole && TENANT_ADMIN_ROLES.has(intraRole)
  const showEspaces = isSuperAdmin || isFormateur || showTenantLink

  // Memes routes et conditions que les cartes « Mes espaces » de la page Profil.
  const espaces: NavItem[] = [
    ...(isSuperAdmin
      ? [{ href: '/admin', icon: Shield, label: 'Administration' }]
      : []),
    ...(isFormateur
      ? [{ href: '/formateur/dashboard', icon: Presentation, label: 'Espace Formateur' }]
      : []),
    ...(showTenantLink
      ? [{ href: '/tenant/admin', icon: Briefcase, label: 'Mon cabinet' }]
      : []),
  ]

  const initial = profile?.first_name?.[0]?.toUpperCase() || 'U'

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
      active ? 'bg-accent/30 text-white' : 'text-white/70 hover:bg-white/5'
    }`

  return (
    // Sidebar desktop uniquement (hidden lg:flex). Sous lg, aucun rendu : la
    // pilule flottante mobile (BottomNav) reste seule.
    <aside
      className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-white/10"
      style={{ background: '#0F0F0F' }}
    >
      {/* Wordmark Certily */}
      <div className="px-6 py-5">
        <span className="text-xl font-black text-white">Certily</span>
      </div>

      {/* Nav principale + Mes espaces */}
      <nav className="flex-1 overflow-y-auto px-3">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link href={item.href} className={linkClass(active)}>
                  <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>

        {showEspaces && (
          <div className="mt-6">
            <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">
              Mes espaces
            </p>
            <ul className="space-y-1">
              {espaces.map((item) => {
                const active = isActive(item.href)
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link href={item.href} className={linkClass(active)}>
                      <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </nav>

      {/* Bloc utilisateur — ancre en bas (mt-auto) */}
      <div className="mt-auto p-3">
        <Link
          href="/profil"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all"
        >
          <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            {profile?.profile_photo_url ? (
              <img src={profile.profile_photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-bold text-sm">{initial}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {profile?.first_name || 'Utilisateur'}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-white/60">
              <span className="font-bold">🔥 {streak?.current_streak ?? 0}</span>
              <span className="text-white/30">·</span>
              <span className="font-bold">{lifetimeRank?.points ?? 0} pts</span>
            </div>
          </div>
        </Link>
      </div>
    </aside>
  )
}
