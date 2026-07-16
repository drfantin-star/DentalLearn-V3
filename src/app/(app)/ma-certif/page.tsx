'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Award, ChevronRight, ClipboardCheck, Loader2, X } from 'lucide-react'
import Link from 'next/link'
import RadarCP from '@/components/profile/RadarCP'
import DemarchesSection from '@/components/profile/DemarchesSection'
import ActionsParAxeSection from '@/components/profile/ActionsParAxeSection'
import { useDemarches } from '@/lib/hooks/useDemarches'
import { useUser } from '@/lib/hooks/useUser'

interface CpProgress {
  axe_id: number
  axe_name: string
  axe_short_name: string
  actions_completed: number
  required_actions: number
}

interface CpSettings {
  cp_start_date: string
  cp_duration_years: number
  cp_end_date: string
}

const SEUIL_DEROGATION = new Date('2023-01-01')

/** Règle référentiel : inscription avant 2023 -> dérogation 9 ans (début 2023-01-01) ;
    inscription à partir de 2023 -> 6 ans depuis la date d'inscription. Même logique
    que la fonction DB create_cp_settings_for_user (migration 20260716e). */
function computeCpPeriod(ordreInscriptionDate: string) {
  const ordreDate = new Date(ordreInscriptionDate)
  if (ordreDate < SEUIL_DEROGATION) {
    return { cp_start_date: '2023-01-01', cp_duration_years: 9, cp_end_date: '2032-01-01' }
  }
  const startDate = ordreDate.toISOString().slice(0, 10)
  const endDate = new Date(ordreDate)
  endDate.setFullYear(endDate.getFullYear() + 6)
  return { cp_start_date: startDate, cp_duration_years: 6, cp_end_date: endDate.toISOString().slice(0, 10) }
}

export default function MaCertifPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user } = useUser()
  const { demarches, loading: demarchesLoading } = useDemarches(user?.id)

  const [loading, setLoading] = useState(true)
  const [actionsParAxe, setActionsParAxe] = useState({ axe1: 0, axe2: 0, axe3: 0, axe4: 0 })
  const [cpSettings, setCpSettings] = useState<CpSettings | null>(null)
  const [cpProgress, setCpProgress] = useState<CpProgress[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [actionsModalOpen, setActionsModalOpen] = useState(false)
  const [autoevalYears, setAutoevalYears] = useState<number[]>([])

  async function loadCpProgress(uid: string) {
    const { data: cpRows } = await supabase
      .from('cp_user_progress')
      .select('axe_id, axe_name, axe_short_name, actions_completed, required_actions')
      .eq('user_id', uid)

    const rows = cpRows ?? []
    setCpProgress(rows as CpProgress[])

    const actionsMap = { axe1: 0, axe2: 0, axe3: 0, axe4: 0 }
    for (const row of rows) {
      const key = `axe${row.axe_id}` as keyof typeof actionsMap
      if (key in actionsMap) actionsMap[key] = Number(row.actions_completed)
    }
    setActionsParAxe(actionsMap)
  }

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUserId(session.user.id)

      const { data } = await supabase
        .from('user_profiles')
        .select('ordre_inscription_date')
        .eq('id', session.user.id)
        .single()

      // Lazy-seed cp_user_settings si absent et date disponible (règle dérogation
      // 9 ans / 6 ans — cf. computeCpPeriod, alignée sur create_cp_settings_for_user).
      if (data?.ordre_inscription_date) {
        const { data: existing } = await supabase
          .from('cp_user_settings')
          .select('cp_start_date, cp_duration_years, cp_end_date')
          .eq('user_id', session.user.id)
          .maybeSingle()
        if (!existing) {
          const computed = computeCpPeriod(data.ordre_inscription_date)
          await supabase.from('cp_user_settings').insert({
            user_id: session.user.id,
            ...computed,
          })
          setCpSettings(computed)
        } else {
          setCpSettings(existing)
        }
      }

      // Lire la vue cp_user_progress (socle CP officiel)
      await loadCpProgress(session.user.id)

      // Années d'auto-évaluation santé réalisées (axe 4) pour la sous-ligne du radar.
      const { data: autoevalRows } = await supabase
        .from('cp_actions')
        .select('validation_date')
        .eq('user_id', session.user.id)
        .eq('action_type', 'auto_evaluation')
      setAutoevalYears([...new Set((autoevalRows ?? []).map(r => Number(String(r.validation_date).slice(0, 4))))])

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-24">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  )

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0F0F0F' }}>

      {/* Header */}
      <header className="bg-gradient-to-br from-primary to-accent px-5 py-4">
        <p className="text-sm font-semibold text-white/80">Ma Certification Periodique</p>
      </header>

      <div className="max-w-2xl lg:max-w-[1500px] mx-auto px-4 lg:px-8 py-6 space-y-6">

        {/* Desktop (lg) : radar a gauche, colonne attestations+actions a droite.
            Mobile : tout empile (space-y-6) — ordre et espacement inchanges.
            items-start : la colonne droite ne s'etire pas a la hauteur du radar. */}
        <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
        {/* Radar CP */}
        <RadarCP
          cpSettings={cpSettings}
          actionsParAxe={actionsParAxe}
          autoevalYears={autoevalYears}
        />

        {/* Attestations (haut) + actions (bas) empilees — colonne droite du
            bloc radar sur desktop. Mobile : meme espacement qu'avant (24px). */}
        <div className="space-y-6 lg:space-y-4">
        {/* Mes attestations Certily */}
        <Link
          href="/ma-certif/attestations"
          className="glass-card transition-premium block p-4 hover:border-white/20 rounded-2xl"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Award className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-white text-sm">
                Mes attestations Certily
              </div>
              <div className="text-xs text-white/70">
                Formations et audits EPP
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/40" />
          </div>
        </Link>

        {/* Carte actions hors Certily */}
        <button
          onClick={() => setActionsModalOpen(true)}
          className="glass-card transition-premium w-full block p-4 hover:border-white/20 rounded-2xl text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/15 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-teal-400" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-white text-sm">
                Mes actions réalisées hors Certily
              </div>
              <div className="text-xs text-white/70">
                Congrès, DU, formations externes…
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/40" />
          </div>
        </button>
        </div>
        </div>

        {/* Modal actions hors Certily */}
        {actionsModalOpen && userId && (
          <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl overflow-hidden" style={{ background: '#1A1A2E', border: '1px solid rgba(255,255,255,0.12)' }}>
              {/* Header modal */}
              <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <h2 className="text-white font-bold text-base">Mes actions réalisées hors Certily</h2>
                <button
                  onClick={() => setActionsModalOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              {/* Contenu scrollable */}
              <div className="overflow-y-auto flex-1 px-4 py-4">
                {cpProgress.length > 0 && (
                  <ActionsParAxeSection
                    userId={userId}
                    cpProgress={cpProgress}
                    onProgressRefresh={() => loadCpProgress(userId)}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Demarches en cours */}
        <DemarchesSection demarches={demarches} loading={demarchesLoading} />

      </div>
    </div>
  )
}
