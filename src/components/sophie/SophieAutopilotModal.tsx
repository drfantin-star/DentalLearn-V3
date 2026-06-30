'use client'

import { useState } from 'react'
import { X, Check, ChevronLeft, ChevronRight, BookOpen, ClipboardList, Heart, FileCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import SophieBubble from './SophieBubble'
import InterestChips from '@/components/interests/InterestChips'
import type { InterestSection } from '@/components/interests/InterestChips'
import type { UserInterests } from '@/lib/supabase/types'
import { axeHex } from '@/lib/cp/axeColors'

interface PlanItem {
  id: string
  itemType: string
  axeId: number
  axeShortName: string
  title: string
  estMinutes: number | null
  status: string
  href: string
}

interface AutopilotData {
  needsSetup: boolean
  weeklyMinutes: number | null
  focus: string[]
  monthKey: string
  items: PlanItem[]
}

interface Props {
  open: boolean
  onClose: () => void
  data: AutopilotData | null
  onChange: () => void
}

// ── Wizard steps ──────────────────────────────────────────────────────────────

interface WizardStep {
  bubble: string
  section?: InterestSection
}

const WIZARD_STEPS: WizardStep[] = [
  {
    bubble: 'Sur quels sujets cliniques veux-tu progresser ce mois-ci ?',
    section: 'clinical',
  },
  {
    bubble: 'Et cote relation patient ?',
    section: 'axe3',
  },
  {
    bubble: 'Et pour ta sante au travail ?',
    section: 'axe4',
  },
  {
    bubble: 'Combien de temps par semaine peux-tu y consacrer ?',
  },
]

const TIME_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 h', value: 60 },
]

// ── Item type picto ───────────────────────────────────────────────────────────

function ItemTypeIcon({ type }: { type: string }) {
  const cls = 'shrink-0 text-white/40'
  if (type === 'formation') return <BookOpen size={14} className={cls} />
  if (type === 'epp') return <ClipboardList size={14} className={cls} />
  if (type === 'autoeval') return <Heart size={14} className={cls} />
  return <FileCheck size={14} className={cls} />
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function SophieAutopilotModal({ open, onClose, data, onChange }: Props) {
  const router = useRouter()

  const [wizardStep, setWizardStep] = useState(0)
  const [interests, setInterests] = useState<UserInterests>({ categories: [], axes: [] })
  const [weeklyMinutes, setWeeklyMinutes] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [planItems, setPlanItems] = useState<PlanItem[] | null>(null)
  const [showWizard, setShowWizard] = useState(false)

  if (!open) return null

  const isSetup = data?.needsSetup ?? true
  const displayItems = planItems ?? data?.items ?? []
  const showPlan = !isSetup && !showWizard

  async function handleGenerate(wm: number) {
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeklyMinutes: wm, focus: interests.categories }),
      })
      if (res.ok) {
        const newData: AutopilotData = await res.json()
        setPlanItems(newData.items)
        setShowWizard(false)
        onChange()
      }
    } finally {
      setSubmitting(false)
    }
  }

  function handleTimeSelect(wm: number) {
    setWeeklyMinutes(wm)
    handleGenerate(wm)
  }

  function handleResetWizard() {
    setWizardStep(0)
    setInterests({ categories: [], axes: [] })
    setWeeklyMinutes(null)
    setShowWizard(true)
  }

  async function handleToggle(item: PlanItem) {
    const nextStatus = item.status === 'done' ? 'todo' : 'done'
    setPlanItems((prev: PlanItem[] | null) =>
      (prev ?? displayItems).map((it: PlanItem) =>
        it.id === item.id ? { ...it, status: nextStatus } : it,
      ),
    )
    await fetch('/api/autopilot', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, status: nextStatus }),
    })
    onChange()
  }

  function handleItemClick(item: PlanItem) {
    onClose()
    router.push(item.href)
  }

  const currentStep = WIZARD_STEPS[wizardStep]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[88vh] flex flex-col"
        onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
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

        <div className="overflow-y-auto flex-1 px-6 pb-8">

          {/* ── WIZARD ─────────────────────────────────────────────────────── */}
          {(isSetup || showWizard) && (
            <div className="space-y-5">
              {/* Sophie bubble */}
              <SophieBubble message={currentStep.bubble} />

              {/* Chips or time buttons */}
              {currentStep.section ? (
                <div>
                  <InterestChips
                    value={interests}
                    onChange={setInterests}
                    sections={[currentStep.section]}
                  />
                </div>
              ) : (
                /* Time step */
                <div className="flex flex-col gap-3">
                  {TIME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={submitting}
                      onClick={() => handleTimeSelect(opt.value)}
                      className="w-full py-3 rounded-2xl bg-white/10 text-white font-semibold hover:bg-white/20 active:bg-white/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {submitting && weeklyMinutes === opt.value ? (
                        <span className="animate-spin text-accent">⏳</span>
                      ) : null}
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setWizardStep((s: number) => Math.max(0, s - 1))}
                  disabled={wizardStep === 0}
                  className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-30"
                >
                  <ChevronLeft size={16} /> Precedent
                </button>

                {/* Dots */}
                <div className="flex gap-1.5">
                  {WIZARD_STEPS.map((_, i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full transition-colors"
                      style={{ background: i === wizardStep ? '#00B8A9' : 'rgba(255,255,255,0.2)' }}
                    />
                  ))}
                </div>

                {/* Next (visible on chip steps only — time step uses its own buttons) */}
                {currentStep.section && (
                  <button
                    type="button"
                    onClick={() => setWizardStep((s: number) => Math.min(WIZARD_STEPS.length - 1, s + 1))}
                    className="flex items-center gap-1 text-sm text-white font-semibold hover:text-accent transition-colors"
                  >
                    Suivant <ChevronRight size={16} />
                  </button>
                )}
                {!currentStep.section && <div className="w-16" />}
              </div>
            </div>
          )}

          {/* ── PLAN ───────────────────────────────────────────────────────── */}
          {showPlan && (
            <div className="space-y-4">
              <SophieBubble message="Voici ton plan du mois 👇" />

              {displayItems.length > 0 ? (
                <div className="space-y-2">
                  {displayItems.map((item: PlanItem) => {
                    const done = item.status === 'done'
                    const color = axeHex(item.axeId)
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-2xl p-3 bg-white/5 hover:bg-white/8 transition-colors"
                      >
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => handleToggle(item)}
                          className="shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
                          style={{
                            borderColor: done ? color : 'rgba(255,255,255,0.25)',
                            background: done ? color : 'transparent',
                          }}
                          aria-label={done ? 'Marquer a faire' : 'Marquer fait'}
                        >
                          {done && <Check size={12} className="text-white" />}
                        </button>

                        {/* Row content — navigates to resource */}
                        <button
                          type="button"
                          className="flex-1 min-w-0 text-left"
                          onClick={() => handleItemClick(item)}
                        >
                          <p
                            className={`text-sm font-medium leading-snug ${
                              done ? 'line-through text-white/35' : 'text-white'
                            }`}
                          >
                            {item.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: `${color}28`, color }}
                            >
                              {item.axeShortName}
                            </span>
                            {item.estMinutes && (
                              <span className="text-[10px] text-white/35">
                                {item.estMinutes} min
                              </span>
                            )}
                          </div>
                        </button>

                        {/* Type picto */}
                        <ItemTypeIcon type={item.itemType} />
                      </div>
                    )
                  })}

                  {/* Placeholder Brief 2 */}
                  <div className="h-px bg-white/5 mt-4" />
                </div>
              ) : (
                <p className="text-sm text-white/50 text-center py-4">
                  Aucun item genere — verifie tes lacunes.
                </p>
              )}

              {/* Refaire */}
              <button
                type="button"
                onClick={handleResetWizard}
                className="text-xs text-white/35 hover:text-white/70 transition-colors mt-2"
              >
                Refaire mon plan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
