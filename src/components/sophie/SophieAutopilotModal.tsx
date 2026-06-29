'use client'

import { useState } from 'react'
import { X, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import SophieBubble from './SophieBubble'
import { axeHex } from '@/lib/cp/axeColors'

interface GapRow {
  axeId: number
  axeShortName: string
  actionsCompleted: number
  requiredActions: number
  progressPercent: number
  validated: boolean
}

interface PlanItem {
  id: string
  axeId: number
  axeShortName: string
  title: string
  estMinutes: number | null
  status: string
  category: string | null
  slug: string | null
}

interface AutopilotData {
  needsSetup: boolean
  weeklyMinutes: number | null
  monthKey: string
  gaps: GapRow[]
  items: PlanItem[]
}

interface Props {
  open: boolean
  onClose: () => void
  data: AutopilotData | null
  onChange: () => void
}

const TIME_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 h', value: 60 },
]

export default function SophieAutopilotModal({ open, onClose, data, onChange }: Props) {
  const router = useRouter()
  const [posting, setPosting] = useState(false)
  const [optimisticItems, setOptimisticItems] = useState<PlanItem[] | null>(null)

  if (!open) return null

  const items = optimisticItems ?? data?.items ?? []
  const needsSetup = data?.needsSetup ?? true
  const firstGap = data?.gaps?.[0]

  const sophieMessage = needsSetup
    ? 'Salut, moi c\'est Sophie \u{1F44B} Pour te preparer un plan sur mesure, combien de temps peux-tu consacrer a ta formation chaque semaine ?'
    : firstGap
    ? `Ce mois-ci, on muscle ton axe ${firstGap.axeShortName}. Voici ton plan \u{1F447}`
    : 'Tu es a jour sur tes axes \u{1F44F} Voici de quoi continuer ce mois-ci \u{1F447}'

  async function handleTimeSelect(weeklyMinutes: number) {
    setPosting(true)
    try {
      const res = await fetch('/api/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeklyMinutes }),
      })
      if (res.ok) {
        const newData: AutopilotData = await res.json()
        setOptimisticItems(newData.items)
        onChange()
      }
    } finally {
      setPosting(false)
    }
  }

  async function handleToggle(item: PlanItem) {
    const nextStatus = item.status === 'done' ? 'todo' : 'done'
    setOptimisticItems(
      (prev) => (prev ?? items).map((it) => (it.id === item.id ? { ...it, status: nextStatus } : it)),
    )
    await fetch('/api/autopilot', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, status: nextStatus }),
    })
    onChange()
  }

  function handleItemClick(item: PlanItem) {
    if (!item.category || !item.slug) return
    onClose()
    router.push(`/formation/${item.category}?formation=${item.slug}&from=home`)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <span className="text-sm font-bold text-accent">Sophie — Plan du mois</span>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Fermer"
          >
            <X size={22} />
          </button>
        </div>

        {/* Sophie bubble */}
        <div className="mb-6">
          <SophieBubble message={sophieMessage} />
        </div>

        {/* Setup state: pick time */}
        {needsSetup && !optimisticItems && (
          <div className="flex flex-col gap-3">
            {TIME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={posting}
                onClick={() => handleTimeSelect(opt.value)}
                className="w-full py-3 rounded-2xl bg-white/10 text-white font-semibold hover:bg-white/20 active:bg-white/30 transition-colors disabled:opacity-50"
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Plan state: list items */}
        {(!needsSetup || optimisticItems) && items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => {
              const done = item.status === 'done'
              const color = axeHex(item.axeId)
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 glass-card rounded-2xl p-3 group"
                >
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => handleToggle(item)}
                    className="shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
                    style={{
                      borderColor: done ? color : 'rgba(255,255,255,0.3)',
                      background: done ? color : 'transparent',
                    }}
                    aria-label={done ? 'Marquer a faire' : 'Marquer fait'}
                  >
                    {done && <Check size={12} className="text-white" />}
                  </button>

                  {/* Content — click navigates to formation */}
                  <button
                    type="button"
                    className="flex-1 min-w-0 text-left"
                    onClick={() => handleItemClick(item)}
                  >
                    <p className={`text-sm font-medium leading-snug ${done ? 'line-through text-white/40' : 'text-white'}`}>
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `${color}30`, color }}
                      >
                        {item.axeShortName}
                      </span>
                      {item.estMinutes && (
                        <span className="text-[10px] text-white/40">
                          {item.estMinutes} min
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              )
            })}

            {/* Placeholder for "Ajouter à mon agenda" (Brief 2) */}
            <div className="h-px bg-white/5 mt-4" />
          </div>
        )}

        {(!needsSetup || optimisticItems) && items.length === 0 && (
          <p className="text-sm text-white/50 text-center py-4">
            Aucun item genere — reviens plus tard.
          </p>
        )}
      </div>
    </div>
  )
}
