'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, BookOpen,
  Loader2, Settings
} from 'lucide-react'
import StatsCards from '@/components/home/StatsCards'
import DemarcheCard from '@/components/home/DemarcheCard'
import RadarCP from '@/components/profile/RadarCP'
import { useDemarches } from '@/lib/hooks/useDemarches'
import { useUser } from '@/lib/hooks/useUser'
import Link from 'next/link'

export default function ProfilPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, profile, streak } = useUser()
  const { demarches, loading: demarchesLoading } = useDemarches(user?.id)
  const [refreshTrigger] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionsParAxe, setActionsParAxe] = useState({ axe1: 0, axe2: 0, axe3: 0, axe4: 0 })
  const [ordreDate, setOrdreDate] = useState<string | null>(null)

  const demarchesScrollRef = useRef<HTMLDivElement>(null)
  const scrollLeft = () => demarchesScrollRef.current?.scrollBy({ left: -320, behavior: 'smooth' })
  const scrollRight = () => demarchesScrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' })

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
        axe1: cp.axe1 || 0, axe2: cp.axe2 || 0,
        axe3: cp.axe3 || 0, axe4: cp.axe4 || 0
      })

      setLoading(false)
    }
    load()
  }, [])

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name)
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    return profile?.first_name?.[0]?.toUpperCase() || 'U'
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-24">
      <Loader2 className="animate-spin text-[#2D1B96]" size={32} />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* Header */}
      <header className="bg-gradient-to-br from-[#2D1B96] to-[#00D1C1] px-5 py-4">
        <p className="text-sm font-semibold text-white/80">Mon espace personnel</p>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Identité + bouton éditer */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-gray-100 flex-shrink-0">
            {profile?.profile_photo_url ? (
              <img src={profile.profile_photo_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#2D1B96] to-[#00D1C1] flex items-center justify-center">
                <span className="text-white font-bold text-lg">{getInitials()}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-base">
              {profile?.first_name && profile?.last_name
                ? `Dr ${profile.first_name} ${profile.last_name}`
                : profile?.first_name || 'Mon profil'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Chirurgien-dentiste</p>
          </div>
          <Link
            href="/profil/edit"
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-sm font-medium text-gray-700"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Éditer</span>
          </Link>
        </div>

        {/* Stats */}
        <StatsCards
          userId={user?.id}
          currentStreak={streak?.current_streak || 0}
          refreshTrigger={refreshTrigger}
        />

        {/* Mes démarches en cours */}
        <section>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-3">
            <BookOpen size={18} className="text-[#8B5CF6]" />
            Mes démarches en cours
          </h2>
          {demarchesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-gray-400" size={24} />
            </div>
          ) : demarches.length > 0 ? (
            <div className="relative">
              <button onClick={scrollLeft}
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 rounded-full bg-white shadow-md items-center justify-center text-gray-600 hover:bg-gray-50">
                <ChevronLeft size={20} />
              </button>
              <div ref={demarchesScrollRef}
                className="flex gap-3 overflow-x-auto scroll-smooth pb-2 snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
                {demarches.map(d => <DemarcheCard key={d.id} demarche={d} />)}
              </div>
              <button onClick={scrollRight}
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 rounded-full bg-white shadow-md items-center justify-center text-gray-600 hover:bg-gray-50">
                <ChevronRight size={20} />
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-5 border border-gray-100 text-center">
              <p className="text-gray-400 text-sm">Aucune démarche en cours</p>
            </div>
          )}
        </section>

        {/* Radar CP */}
        <RadarCP
          ordreInscriptionDate={ordreDate}
          actionsParAxe={actionsParAxe}
        />

      </div>
    </div>
  )
}
