'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  GraduationCap,
  ShieldCheck,
  HeartHandshake,
  HeartPulse,
  type LucideIcon,
} from 'lucide-react'

interface NavTab {
  href: string
  icon: LucideIcon
  label: string
}

const tabs: NavTab[] = [
  { href: '/', icon: Home, label: 'Accueil' },
  { href: '/formation', icon: GraduationCap, label: 'Formation' },
  { href: '/conformite', icon: ShieldCheck, label: 'Conformité' },
  { href: '/patient', icon: HeartHandshake, label: 'Patient' },
  { href: '/sante', icon: HeartPulse, label: 'Santé Pro' },
]

export default function BottomNav() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  // Ne pas afficher la nav sur les pages auth
  if (pathname.startsWith('/login') || pathname.startsWith('/register') || 
      pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password')) {
    return null
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2 py-2 z-40 safe-bottom">
      <div className="max-w-lg mx-auto flex justify-around">
        {tabs.map((tab) => {
          const active = isActive(tab.href)
          const Icon = tab.icon

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-xl transition-all ${
                active
                  ? 'bg-gradient-to-b from-[#2D1B96]/10 to-[#00D1C1]/10'
                  : 'hover:bg-gray-50'
              }`}
            >
              <Icon
                size={22}
                className={active ? 'text-[#2D1B96]' : 'text-gray-400'}
                strokeWidth={active ? 2.5 : 2}
              />
              <span
                className={`text-[10px] mt-1 font-medium ${
                  active ? 'text-[#2D1B96]' : 'text-gray-400'
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
