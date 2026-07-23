'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Loader2, Sparkles } from 'lucide-react'
import { axeHex } from '@/lib/cp/axeColors'
import type { Formation } from '@/lib/supabase/types'
import FormationCardOverlay from '@/components/home/FormationCardOverlay'
import EppCardBackground from '@/components/home/EppCardBackground'
import { mediaCardSizeStyle } from '@/components/home/MediaCard'
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
  alreadyStarted?: boolean
  coverImageUrl?: string | null
  coverCutoutUrl?: string | null
  category?: string | null
}

interface AutopilotData {
  needsSetup: boolean
  weeklyMinutes: number | null
  focus: string[]
  monthKey: string
  items: PlanItem[]
}

type FetchState = 'loading' | 'error' | 'ready'

// ── Carte d'un item du plan ─────────────────────────────────────────────────
// Identite par construction avec la rangee « Reprendre » de la home :
//  - formation : REUTILISE FormationCardOverlay tel quel (degrade de categorie
//    natif, pas de progressPercent — les items du plan sont non commences).
//  - epp / autoeval / attestation : meme patron que le bloc EPP de « Reprendre »
//    (shell landscape + EppCardBackground + titre centre clamp 4). EPP -> teal
//    Axe 2 (sans prop color) ; autoeval/attestation -> couleur de l'axe.
function PlanItemCard({ item, onClick }: { item: PlanItem; onClick: () => void }) {
  if (item.itemType === 'formation') {
    const formation = {
      title: item.title,
      category: item.category ?? '',
      cover_image_url: item.coverImageUrl ?? null,
      cover_cutout_url: item.coverCutoutUrl ?? null,
    } as unknown as Formation
    return <FormationCardOverlay formation={formation} aspect="landscape" onClick={onClick} />
  }

  const bgColor = item.itemType === 'epp' ? undefined : axeHex(item.axeId)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={item.title}
      className="flex-shrink-0 snap-start rounded-2xl overflow-hidden text-left active:scale-[0.98] transition-transform duration-150 relative"
      style={{
        ...mediaCardSizeStyle('landscape'),
        border: '0.5px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
    >
      <EppCardBackground color={bgColor} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '14px',
        }}
      >
        <p
          style={{
            margin: 0,
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: 700,
            color: 'white',
            lineHeight: 1.3,
            textShadow: '0 2px 6px rgba(0,0,0,0.85)',
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.title}
        </p>
      </div>
    </button>
  )
}

// ── Section « Mon plan du mois » ─────────────────────────────────────────────
// Items PREVUS par Sophie (Autopilot) ce mois-ci, distincte de « Mes demarches
// en cours » (ce qui est COMMENCE). Pure consommatrice de GET /api/autopilot :
// masque les items alreadyStarted et status === 'done' (filtre calcule cote
// API, jamais duplique ici).
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

  // Refetch a la fermeture du modal — couvre le cas needsSetup (plan cree) et
  // toute (re)generation depuis « Refaire mon plan ».
  function closeModal() {
    setModalOpen(false)
    fetchData()
  }

  // Erreur API : section masquee silencieusement (pas d'ecran d'erreur).
  if (state === 'error') return null

  const needsSetup = data?.needsSetup ?? false
  const totalCount = data?.items?.length ?? 0
  // Items visibles : a faire ET pas deja engages ailleurs.
  const visibleItems = (data?.items ?? []).filter(
    (it) => it.status === 'todo' && !it.alreadyStarted,
  )
  // Plan absent et non configurable (aucun item genere) : rien a montrer.
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
        // Jamais configure Sophie : carte d'appel unique.
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
      ) : visibleItems.length > 0 ? (
        // Plan existant avec au moins un item a faire : le carrousel.
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
            {visibleItems.map((item) => (
              <PlanItemCard key={item.id} item={item} onClick={() => router.push(item.href)} />
            ))}
          </div>
          <button
            onClick={scrollRight}
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 rounded-full glass-card shadow-md items-center justify-center text-white/70 hover:text-white transition-premium"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      ) : (
        // Plan existant, plus rien a afficher (tout fait ou deja engage ailleurs).
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
