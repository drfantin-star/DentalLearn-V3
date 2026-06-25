'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, BookOpen,
  Loader2, Settings, Award, Briefcase, Building2,
  Shield, Presentation,
} from 'lucide-react'
import StatsCards from '@/components/home/StatsCards'
import DemarcheCard from '@/components/home/DemarcheCard'
import InterestsSection from '@/components/interests/InterestsSection'
import RadarCP from '@/components/profile/RadarCP'
import CreateCabinetModal from '@/components/auth/CreateCabinetModal'
import { useDemarches } from '@/lib/hooks/useDemarches'
import { useUser } from '@/lib/hooks/useUser'
import Link from 'next/link'
import type { IntraRole } from '@/lib/auth/rbac'

const TENANT_ADMIN_ROLES: ReadonlySet<IntraRole> = new Set<IntraRole>([
  'titulaire',
  'admin_rh',
  'admin_of',
])

export default function ProfilPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, streak } = useUser()
  const { demarches, loading: demarchesLoading } = useDemarches(user?.id)
  const [refreshTrigger] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionsParAxe, setActionsParAxe] = useState({ axe1: 0, axe2: 0, axe3: 0, axe4: 0 })
  const [ordreDate, setOrdreDate] = useState<string | null>(null)
  const [intraRole, setIntraRole] = useState<IntraRole | null>(null)
  const [orgless, setOrgless] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [isFormateur, setIsFormateur] = useState(false)
  const [showCabinetModal, setShowCabinetModal] = useState(false)

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

      // Lecture intra_role + flags roles globaux via API serveur (cache RBAC).
      try {
        const res = await fetch('/api/user/intra-role')
        if (res.ok) {
          const json = await res.json()
          setIntraRole((json.intra_role as IntraRole | null) ?? null)
          setOrgless(Boolean(json.orgless))
          setIsSuperAdmin(Boolean(json.is_super_admin))
          setIsFormateur(Boolean(json.is_formateur))
        }
      } catch {
        // Fail silencieux : cartes simplement masquees si on ne sait pas.
      }

      setLoading(false)
    }
    load()
  }, [])

  const showTenantLink = intraRole && TENANT_ADMIN_ROLES.has(intraRole)
  const showUpgradeCard = !loading && orgless && !intraRole
  const showEspacesSection = isSuperAdmin || isFormateur || showTenantLink

  const handleCabinetCreated = async () => {
    setShowCabinetModal(false)
    // Refresh session pour propager intra_role + cache RBAC cote serveur
    await supabase.auth.refreshSession()
    router.refresh()
    // Re-fetch local pour mise a jour immediate sans attendre un rerender SSR
    try {
      const res = await fetch('/api/user/intra-role')
      if (res.ok) {
        const json = await res.json()
        setIntraRole((json.intra_role as IntraRole | null) ?? null)
        setOrgless(Boolean(json.orgless))
        setIsSuperAdmin(Boolean(json.is_super_admin))
        setIsFormateur(Boolean(json.is_formateur))
      }
    } catch {
      // Idem : fail silencieux
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-24">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  )

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0F0F0F' }}>

      {/* Header */}
      <header className="bg-gradient-to-br from-primary to-accent px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-white/80">Mon espace personnel</p>
          <div className="flex items-center gap-2">
            {/*
              D2-T3.5-01 — les liens header "Administration" et "Espace formateur"
              ont ete retires (doublon avec la section "Mes espaces" du body).
              Le lien "Mon cabinet" les rejoint : il est desormais une carte de
              la section "Mes espaces" (unification header -> body).
            */}
            <Link
              href="/profil/edit"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-xl transition-premium"
            >
              <Settings className="w-4 h-4 text-white" />
              <span className="text-xs font-semibold text-white">Editer mon profil</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Stats */}
        <StatsCards
          userId={user?.id}
          currentStreak={streak?.current_streak || 0}
          refreshTrigger={refreshTrigger}
        />

        {/* Centres d'interet — carte + modal d'edition */}
        <InterestsSection />

        {/* Mes attestations */}
        <Link
          href="/profil/attestations"
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

        {/* Mes demarches en cours */}
        <section>
          <h2 className="text-base font-bold text-white flex items-center gap-2 mb-3">
            <BookOpen size={18} className="text-[#8B5CF6]" />
            Mes demarches en cours
          </h2>
          {demarchesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-white/40" size={24} />
            </div>
          ) : demarches.length > 0 ? (
            <div className="relative">
              <button onClick={scrollLeft}
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 rounded-full glass-card shadow-md items-center justify-center text-white/70 hover:text-white transition-premium">
                <ChevronLeft size={20} />
              </button>
              <div ref={demarchesScrollRef}
                className="flex gap-3 overflow-x-auto scroll-smooth pb-2 snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
                {demarches.map(d => <DemarcheCard key={d.id} demarche={d} />)}
              </div>
              <button onClick={scrollRight}
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 rounded-full glass-card shadow-md items-center justify-center text-white/70 hover:text-white transition-premium">
                <ChevronRight size={20} />
              </button>
            </div>
          ) : (
            <div className="glass-card p-5 text-center rounded-2xl">
              <p className="text-white/55 text-sm">Aucune demarche en cours</p>
            </div>
          )}
        </section>

        {/* Certification Periodique */}
        <RadarCP
          ordreInscriptionDate={ordreDate}
          actionsParAxe={actionsParAxe}
        />

        {/* Carte upgrade solo -> cabinet (uniquement si orgless) */}
        {showUpgradeCard && (
          <button
            type="button"
            onClick={() => setShowCabinetModal(true)}
            className="glass-card transition-premium w-full p-4 text-left hover:border-white/20 rounded-2xl"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-[#8B5CF6]" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white text-sm">
                  Creer mon cabinet
                </div>
                <div className="text-xs text-white/55">
                  Devenez titulaire et invitez vos collaborateurs.
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-white/40" />
            </div>
          </button>
        )}

        {/* Mes espaces — visible si super_admin et/ou formateur (cumul OK) */}
        {showEspacesSection && (
          <section>
            <h2 className="text-base font-bold text-white mb-1">
              Mes espaces
            </h2>
            <p className="text-xs text-white/55 mb-3">
              Accedez a vos espaces dedies selon vos roles.
            </p>
            <div className="space-y-3">
              {isSuperAdmin && (
                <Link
                  href="/admin"
                  className="glass-card transition-premium block p-4 hover:border-amber-500/40 rounded-2xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-white text-sm">
                        Administration
                      </div>
                      <div className="text-xs text-white/55">
                        Gestion de la plateforme, formateurs, organisations.
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/40" />
                  </div>
                </Link>
              )}
              {isFormateur && (
                <Link
                  href="/formateur/dashboard"
                  className="glass-card transition-premium block p-4 hover:border-white/20 rounded-2xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                      <Presentation className="w-5 h-5 text-[#8B5CF6]" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-white text-sm">
                        Espace Formateur
                      </div>
                      <div className="text-xs text-white/55">
                        Suivez vos formations animees, masterclass et profil public.
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/40" />
                  </div>
                </Link>
              )}
              {showTenantLink && (
                <Link
                  href="/tenant/admin"
                  className="glass-card transition-premium block p-4 hover:border-white/20 rounded-2xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                      <Briefcase className="w-5 h-5 text-[#8B5CF6]" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-white text-sm">
                        Mon cabinet
                      </div>
                      <div className="text-xs text-white/55">
                        Gerez votre cabinet, vos collaborateurs et leurs acces.
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/40" />
                  </div>
                </Link>
              )}
            </div>
          </section>
        )}

      </div>

      {showCabinetModal && (
        <CreateCabinetModal
          onClose={() => setShowCabinetModal(false)}
          onCreated={handleCabinetCreated}
        />
      )}
    </div>
  )
}
