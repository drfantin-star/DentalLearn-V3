'use client'

import { useEffect, useState } from 'react'
import { Laptop } from 'lucide-react'

interface DesktopOnlyProps {
  children: React.ReactNode
  title?: string
}

export default function DesktopOnly({ children, title }: DesktopOnlyProps) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // État de chargement neutre — évite le flash de contenu
  if (isMobile === null) {
    return <div className="min-h-screen" style={{ background: '#0F0F0F' }} />
  }

  if (!isMobile) {
    return <>{children}</>
  }

  const subject = title ?? 'Cet outil'

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: '#0F0F0F' }}
    >
      <div className="mb-6 p-4 rounded-2xl bg-accent/10">
        <Laptop size={40} className="text-accent" />
      </div>
      <h1 className="text-xl font-black text-white mb-4">
        Cet outil t&apos;attend sur ton ordinateur
      </h1>
      <p className="text-sm text-white/70 leading-relaxed max-w-xs">
        {subject} demande de la saisie, des documents et des échéances à
        suivre. On a préféré te l&apos;offrir en grand format plutôt
        qu&apos;à l&apos;étroit.
      </p>
      <p className="text-sm text-white/70 leading-relaxed max-w-xs mt-4">
        Connecte-toi sur ton ordinateur avec le même compte pour y accéder.
      </p>
    </div>
  )
}
