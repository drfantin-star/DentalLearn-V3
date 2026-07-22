'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import LeaderboardPanel from './LeaderboardPanel'

interface LeaderboardModalProps {
  open: boolean
  onClose: () => void
  userId?: string
}

export default function LeaderboardModal({ open, onClose, userId }: LeaderboardModalProps) {
  const [tab, setTab] = useState<'weekly' | 'lifetime'>('weekly')

  // Mobile : un tap sur la carte ferme le modal. Desktop : c'est la croix qui
  // gère, le tap sur la carte ne ferme pas. On exclut tout élément interactif
  // (onglets, boutons du Panel, croix) pour ne pas fermer par-dessus eux.
  const handleCardTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches) return
    if ((e.target as HTMLElement).closest('button, a, input')) return
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      variant="dark"
      ariaLabel="Classement"
      className="bg-transparent shadow-none"
    >
      {/* Onglets — sur le fond sombre flouté du backdrop (Modal transparent) */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('weekly')}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold text-white transition-colors ${
            tab === 'weekly' ? 'bg-white/25' : 'bg-white/10 hover:bg-white/15'
          }`}
        >
          Cette semaine
        </button>
        <button
          onClick={() => setTab('lifetime')}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold text-white transition-colors ${
            tab === 'lifetime' ? 'bg-white/25' : 'bg-white/10 hover:bg-white/15'
          }`}
        >
          Depuis toujours
        </button>
      </div>

      {/* La carte = le modal. Croix desktop uniquement, tap-to-close mobile. */}
      <div className="relative" onClick={handleCardTap}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="hidden sm:flex absolute top-3 right-3 z-10 items-center justify-center p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <LeaderboardPanel userId={userId} mode={tab} compact={false} />
      </div>
    </Modal>
  )
}
