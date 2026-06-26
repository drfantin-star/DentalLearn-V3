'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Award, ChevronRight, Loader2 } from 'lucide-react'
import Link from 'next/link'
import RadarCP from '@/components/profile/RadarCP'
import DemarchesSection from '@/components/profile/DemarchesSection'
import { useDemarches } from '@/lib/hooks/useDemarches'
import { useUser } from '@/lib/hooks/useUser'

export default function MaCertifPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user } = useUser()
  const { demarches, loading: demarchesLoading } = useDemarches(user?.id)

  const [loading, setLoading] = useState(true)
  const [actionsParAxe, setActionsParAxe] = useState({ axe1: 0, axe2: 0, axe3: 0, axe4: 0 })
  const [ordreDate, setOrdreDate] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data } = await supabase
        .from('user_profiles')
        .select('ordre_inscription_date')
        .eq('id', session.user.id)
        .single()

      if (data) setOrdreDate(data.ordre_inscription_date)

      const { data: cp } = await supabase
        .rpc('get_user_cp_progress', { p_user_id: session.user.id })
      if (cp) setActionsParAxe({
        axe1: cp.axe1 || 0,
        axe2: cp.axe2 || 0,
        axe3: cp.axe3 || 0,
        axe4: cp.axe4 || 0,
      })

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

        {/* Demarches en cours */}
        <DemarchesSection demarches={demarches} loading={demarchesLoading} />

      </div>
    </div>
  )
}
