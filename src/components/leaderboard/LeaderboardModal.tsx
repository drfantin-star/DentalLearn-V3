'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import LeaderboardPanel from './LeaderboardPanel'

interface LeaderboardModalProps {
  open: boolean
  onClose: () => void
  userId?: string
}

export default function LeaderboardModal({ open, onClose, userId }: LeaderboardModalProps) {
  const [tab, setTab] = useState<'weekly' | 'lifetime'>('weekly')

  return (
    <Modal open={open} onClose={onClose} size="lg" variant="dark" ariaLabel="Classement">
      <Modal.Header title="Classement" onClose={onClose} />
      <Modal.Body>
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
        <LeaderboardPanel userId={userId} mode={tab} compact={false} />
      </Modal.Body>
    </Modal>
  )
}
