'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Award, ChevronRight, Loader2 } from 'lucide-react'
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

export default function MaCertifPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user } = useUser()
  const { demarches, loading: demarchesLoading } = useDemarches(user?.id)

  const [loading, setLoading] = useState(true)
  const [actionsParAxe, setActionsParAxe] = useState({ axe1: 0, axe2: 0, axe3: 0, axe4: 0 })
  const [ordreDate, setOrdreDate] = useState<string | null>(null)
  const [cpProgress, setCpProgress] = useState<CpProgress[]>([])
  const [userId, setUserId] = useState<string | null>(null)

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

      if (data) setOrdreDate(data.ordre_inscription_date)

      // Lazy-seed cp_user_settings si absent et date disponible
      if (data?.ordre_inscription_date) {
        const { data: existing } = await supabase
          .from('cp_user_settings')
          .select('user_id')
          .eq('user_id', session.user.id)
          .maybeSingle()
        if (!existing) {
          const ordreRaw = new Date(data.ordre_inscription_date)
          const cpStart = ordreRaw >= new Date('2023-01-01') ? ordreRaw : new Date('2023-01-01')
          const startDate = cpStart.toISOString().slice(0, 10)
          const endDate = new Date(cpStart)
          endDate.setFullYear(endDate.getFullYear() + 6)
          await supabase.from('cp_user_settings').insert({
            user_id: session.user.id,
            cp_start_date: startDate,
            cp_duration_years: 6,
            cp_end_date: endDate.toISOString().slice(0, 10),
          })
        }
      }

      // Lire la vue cp_user_progress (socle CP officiel)
      await loadCpProgress(session.user.id)

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

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Radar CP */}
        <RadarCP
          ordreInscriptionDate={ordreDate}
          actionsParAxe={actionsParAxe}
        />

        {/* Mes attestations */}
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
                Mes attestations
              </div>
              <div className="text-xs text-white/55">
                Formations et audits EPP
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/40" />
          </div>
        </Link>

        {/* Actions par axe (déclarations manuelles) */}
        {userId && cpProgress.length > 0 && (
          <ActionsParAxeSection
            userId={userId}
            cpProgress={cpProgress}
            onProgressRefresh={() => loadCpProgress(userId)}
          />
        )}

        {/* Demarches en cours */}
        <DemarchesSection demarches={demarches} loading={demarchesLoading} />

      </div>
    </div>
  )
}
