'use client'

import { ExternalLink, Check, Circle, MinusCircle } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import {
  deriveEffectiveStatus,
  type EffectiveComplianceStatus,
} from '@/lib/hooks/useCabinetCompliance'
import type {
  CabinetComplianceCategory,
  CabinetComplianceItem,
  ComplianceStatus,
  UserCabinetCompliance,
} from '@/lib/supabase/types'

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Quotidien',
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
  yearly: 'Annuel',
  multi_year: 'Pluriannuel',
  on_change: 'À chaque changement',
  once: 'Une fois',
}

const APPLIES_WHEN_LABELS: Record<string, string> = {
  always: '',
  xray: 'Si appareil RX',
  employer: 'Si ≥1 salarié',
  hds: 'Si données chez un tiers',
  prescriber: 'Si prescription',
  stupefiant_stock: 'Si stock de stupéfiants',
  dae: 'Si DAE présent',
}

const STATUS_OPTIONS: {
  value: ComplianceStatus
  label: string
  icon: typeof Check
  activeClass: string
}[] = [
  { value: 'todo', label: 'À faire', icon: Circle, activeClass: 'bg-amber-50 text-amber-700 border-amber-300' },
  { value: 'done', label: 'Fait', icon: Check, activeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
  { value: 'not_applicable', label: 'N/A', icon: MinusCircle, activeClass: 'bg-slate-50 text-slate-500 border-slate-300' },
]

function StatusBadge({ status }: { status: EffectiveComplianceStatus }) {
  if (status === 'done') return <Badge variant="success">Fait</Badge>
  if (status === 'expired') return <Badge variant="danger">Expiré</Badge>
  if (status === 'not_applicable') return <Badge variant="neutral">Non applicable</Badge>
  return <Badge variant="warning">À faire</Badge>
}

interface CategoryItemsModalProps {
  open: boolean
  onClose: () => void
  category: CabinetComplianceCategory | null
  items: CabinetComplianceItem[]
  progressByItem: Record<string, UserCabinetCompliance>
  todayISO: string
  onSetStatus: (itemId: string, status: ComplianceStatus) => void
}

export default function CategoryItemsModal({
  open,
  onClose,
  category,
  items,
  progressByItem,
  todayISO,
  onSetStatus,
}: CategoryItemsModalProps) {
  if (!category) return null

  return (
    <Modal open={open} onClose={onClose} size="lg" ariaLabel={category.name}>
      <Modal.Header title={category.name} onClose={onClose} />
      <Modal.Body className="space-y-3">
        {items.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">
            Aucun item dans cette catégorie.
          </p>
        )}

        {items.map((item) => {
          const row = progressByItem[item.id]
          const effective = deriveEffectiveStatus(row, todayISO)
          const current: ComplianceStatus = row?.status ?? 'todo'
          const appliesLabel = APPLIES_WHEN_LABELS[item.applies_when] || ''

          return (
            <div
              key={item.id}
              className="rounded-2xl border border-gray-100 p-4 bg-white"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm text-gray-900">
                    {item.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px] text-gray-400">
                    {item.frequency && (
                      <span>{FREQUENCY_LABELS[item.frequency] ?? item.frequency}</span>
                    )}
                    {!item.is_mandatory && <span>· Recommandé</span>}
                    {appliesLabel && <span>· {appliesLabel}</span>}
                  </div>
                </div>
                <StatusBadge status={effective} />
              </div>

              {item.reference_text && (
                <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
                  {item.reference_text}
                </p>
              )}

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="inline-flex rounded-xl border border-gray-200 overflow-hidden">
                  {STATUS_OPTIONS.map((opt) => {
                    const Icon = opt.icon
                    const active = current === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onSetStatus(item.id, opt.value)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-r border-gray-200 last:border-r-0 transition-colors',
                          active
                            ? opt.activeClass
                            : 'bg-white text-gray-400 hover:bg-gray-50',
                        )}
                        aria-pressed={active}
                      >
                        <Icon size={13} />
                        {opt.label}
                      </button>
                    )
                  })}
                </div>

                {item.official_url && (
                  <a
                    href={item.official_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                  >
                    Source officielle
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </Modal.Body>
    </Modal>
  )
}
