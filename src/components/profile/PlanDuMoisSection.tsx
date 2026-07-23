'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarCheck, ChevronLeft, ChevronRight, Loader2, Sparkles } from 'lucide-react'
import { axeHex } from '@/lib/cp/axeColors'
import SophieAutopilotModal from '@/components/sophie/SophieAutopilotModal'

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

type FetchState = 'loading' | 'error' | 'ready'

// Section « Mon plan du mois » — items PRÉVUS par Sophie (Autopilot) ce mois-ci,
// distincte de « Mes démarches en cours » (ce qui est COMMENCÉ). Lecture seule
// sur GET /api/autopilot ; le SophieAutopilotModal (contrôlé) porte la config.
export default function PlanDuMoisSection() {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)

  const [state, setState] = useState<FetchState>('loading')
  const [data, setData] = useState<AutopilotData | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/autopilot')
      if (!res.ok) { setState('error'); return }
      setData(await res.json())
      setState('ready')
    } catch {
      setState('error')
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const scrollLeft = () => scrollRef.current?.scrollBy({ left: -320, behavior: 'smooth' })
  const scrollRight = () => scrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' })

  // Refetch à la fermeture du modal — couvre le cas needsSetup (plan créé) et
  // toute (re)génération depuis « Refaire mon plan ».
  function closeModal() {
    setModalOpen(false)
    fetchData()
  }

  // Erreur API : section masquée silencieusement (pas d'écran d'erreur).
  if (state === 'error') return null

  const todoItems = (data?.items ?? []).filter((it) => it.status === 'todo')
  const totalCount = data?.items?.length ?? 0
  const needsSetup = data?.needsSetup ?? false
  // Plan absent et non configurable (aucun item généré) : rien à montrer.
  const emptyPlan = state === 'ready' && !needsSetup && totalCount === 0

  if (emptyPlan) return null

  return (
    <section>
      <h2 className="text-base font-bold text-white flex items-center gap-2 mb-3">
        <Sparkles size={18} className="text-accent" />
        Mon plan du mois
      </h2>

      {state === 'loading' ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-white/40" size={24} />
        </div>
      ) : needsSetup ? (
        // Jamais configuré Sophie : carte d'appel unique.
        <button
          onClick={() => setModalOpen(true)}
          className="glass-card transition-premium w-full block p-4 hover:border-white/20 rounded-2xl text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white text-sm">
                Crée ton plan du mois avec Sophie
              </div>
              <div className="text-xs text-white/70">
                Sophie sélectionne tes actions de certification pour ce mois-ci
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/40 shrink-0" />
          </div>
        </button>
      ) : todoItems.length > 0 ? (
        // Plan existant avec au moins un item à faire : le carrousel.
        <div className="relative">
          <button
            onClick={scrollLeft}
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 rounded-full glass-card shadow-md items-center justify-center text-white/70 hover:text-white transition-premium"
          >
            <ChevronLeft size={20} />
          </button>
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto scroll-smooth pb-2 snap-x snap-mandatory scrollbar-hide -mx-4 px-4"
          >
            {todoItems.map((item) => {
              const color = axeHex(item.axeId)
              return (
                <button
                  key={item.id}
                  onClick={() => router.push(item.href)}
                  className="snap-start shrink-0 w-64 glass-card rounded-2xl p-4 text-left flex flex-col justify-between min-h-[152px] hover:border-white/20 transition-premium"
                >
                  <div>
                    <span
                      className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-2"
                      style={{ background: `${color}28`, color }}
                    >
                      {item.axeShortName}
                    </span>
                    <p
                      className="text-sm font-semibold text-white leading-snug"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {item.title}
                    </p>
                  </div>
                  {item.estMinutes != null && (
                    <div className="flex items-center gap-1.5 text-xs text-white/70 mt-3">
                      <CalendarCheck size={14} className="text-white/50" />
                      {item.estMinutes} min
                    </div>
                  )}
                </button>
              )
            })}
          </div>
          <button
            onClick={scrollRight}
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 rounded-full glass-card shadow-md items-center justify-center text-white/70 hover:text-white transition-premium"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      ) : (
        // Plan existant, 0 item à faire (tout coché fait).
        <div className="glass-card p-5 rounded-2xl flex items-center justify-between gap-3">
          <p className="text-white/70 text-sm">Plan du mois terminé 👏</p>
          <button
            onClick={() => setModalOpen(true)}
            className="text-xs text-accent hover:underline shrink-0"
          >
            Refaire mon plan
          </button>
        </div>
      )}

      <SophieAutopilotModal
        open={modalOpen}
        onClose={closeModal}
        data={data}
        onChange={fetchData}
      />
    </section>
  )
}
