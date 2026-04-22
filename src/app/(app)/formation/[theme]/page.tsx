'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  getCategoryConfig,
  useUserFormationProgress,
  type Formation,
  type Sequence,
} from '@/lib/supabase'
import { useUser } from '@/lib/hooks/useUser'
import FormationDetail from '@/components/formation/FormationDetail'
import SequencePlayer from '@/components/formation/SequencePlayer'
import FormationCardOverlay from '@/components/home/FormationCardOverlay'
import DemarcheCard from '@/components/home/DemarcheCard'

// ============================================
// THEMES CONFIG
// ============================================

const THEMES_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  'esthetique': { label: 'Esthétique Dentaire', icon: '✨', color: '#8B5CF6' },
  'restauratrice': { label: 'Dentisterie Restauratrice', icon: '🦷', color: '#F59E0B' },
  'endodontie': { label: 'Endodontie', icon: '🔬', color: '#6366F1' },
  'chirurgie': { label: 'Chirurgie Orale', icon: '💉', color: '#EF4444' },
  'implant': { label: 'Implantologie', icon: '🔩', color: '#10B981' },
  'prothese': { label: 'Prothèse', icon: '👄', color: '#F97316' },
  'parodontologie': { label: 'Parodontologie', icon: '🧬', color: '#EC4899' },
  'radiologie': { label: 'Radiologie', icon: '🩻', color: '#14B8A6' },
  'ergonomie': { label: 'Ergonomie', icon: '🪑', color: '#F59E0B' },
  'relation-patient': { label: 'Relation Patient', icon: '🤝', color: '#F97316' },
  'sante-pro': { label: 'Santé du Praticien', icon: '💚', color: '#10B981' },
  'numerique': { label: 'Numérique & IA', icon: '🤖', color: '#6366F1' },
  'environnement': { label: 'Environnement', icon: '🌿', color: '#22C55E' },
  'management': { label: 'Management', icon: '💼', color: '#78716C' },
  'organisation': { label: 'Organisation', icon: '📋', color: '#64748B' },
  'soft-skills': { label: 'Soft Skills', icon: '🤝', color: '#D97706' },
}

function getThemeConfig(slug: string) {
  return THEMES_CONFIG[slug] || { label: slug, icon: '📚', color: '#6B7280' }
}

// ============================================
// TYPES
// ============================================

interface EppAudit {
  id: string
  title: string
  slug: string
  description: string
  theme_slug: string
  nb_dossiers_min: number
  nb_dossiers_max: number
  delai_t2_mois_min: number
  delai_t2_mois_max: number
  is_published: boolean
}

interface UserEppSession {
  id: string
  audit_id: string
  tour: number
  started_at: string
  completed_at: string | null
  score_global: number | null
}

type ViewMode = 'theme' | 'formation' | 'sequence'

// ============================================
// PAGE THÉMATIQUE
// ============================================

export default function ThemePage() {
  const params = useParams<{ theme: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const themeSlug = params.theme
  const formationSlugParam = searchParams.get('formation')
  const fromPage = searchParams.get('from') || '/formation'

  const { user } = useUser()
  const [formations, setFormations] = useState<Formation[]>([])
  const [eppAudit, setEppAudit] = useState<EppAudit | null>(null)
  const [eppSessions, setEppSessions] = useState<UserEppSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [formationProgress, setFormationProgress] = useState<
    Record<string, { isStarted: boolean; isCompleted: boolean }>
  >({})
  const formationsScrollRef = useRef<HTMLDivElement>(null)
  const formationsScrollLeft = () =>
    formationsScrollRef.current?.scrollBy({ left: -320, behavior: 'smooth' })
  const formationsScrollRight = () =>
    formationsScrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' })

  // ViewMode pour la navigation interne (formation detail + sequence player)
  const [viewMode, setViewMode] = useState<ViewMode>('theme')
  const [selectedFormationId, setSelectedFormationId] = useState<string | null>(null)
  const [selectedAccessType, setSelectedAccessType] = useState<'demo' | 'full' | null>(null)
  const [selectedSequence, setSelectedSequence] = useState<Sequence | null>(null)
  const [sequenceGradient, setSequenceGradient] = useState<{ from: string; to: string }>({ from: '#8B5CF6', to: '#A78BFA' })

  const { markCompleted } = useUserFormationProgress(selectedFormationId)

  const themeConfig = getThemeConfig(themeSlug)

  useEffect(() => {
    loadData()
  }, [themeSlug])

  // Ouvrir directement une formation si ?formation=slug est présent
  useEffect(() => {
    if (formationSlugParam && formations.length > 0 && viewMode === 'theme') {
      const formation = formations.find(f => f.slug === formationSlugParam)
      if (formation) {
        openFormation(formation)
      }
    }
  }, [formationSlugParam, formations])

  useEffect(() => {
    if (!user?.id || formations.length === 0) return
    async function fetchProgress() {
      const supabase = createClient()
      const { data } = await supabase
        .from('user_formations')
        .select('formation_id, current_sequence, completed_at')
        .eq('user_id', user!.id)
      if (data) {
        const map: Record<string, { isStarted: boolean; isCompleted: boolean }> = {}
        data.forEach((uf) => {
          map[uf.formation_id] = {
            isStarted: true,
            isCompleted: !!uf.completed_at,
          }
        })
        setFormationProgress(map)
      }
    }
    fetchProgress()
  }, [user?.id, formations])

  const loadData = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // 1. Charger les formations de cette thématique
      const { data: formationsData, error: fErr } = await supabase
        .from('formations')
        .select('*')
        .eq('is_published', true)
        .ilike('category', themeSlug)
        .order('created_at', { ascending: false })

      if (fErr) throw fErr
      setFormations(formationsData || [])

      // 2. Charger l'audit EPP de cette thématique (s'il existe)
      const { data: eppData } = await supabase
        .from('epp_audits')
        .select('*')
        .eq('theme_slug', themeSlug)
        .eq('is_published', true)
        .limit(1)
        .maybeSingle()

      setEppAudit(eppData)

      // 3. Charger les sessions EPP de l'utilisateur
      if (user && eppData) {
        const { data: sessionsData } = await supabase
          .from('user_epp_sessions')
          .select('id, audit_id, tour, started_at, completed_at, score_global')
          .eq('user_id', user.id)
          .eq('audit_id', eppData.id)
          .order('tour')

        if (sessionsData) setEppSessions(sessionsData)
      }
    } catch (err) {
      console.error('Erreur loadData:', err)
      setError(err instanceof Error ? err : new Error('Erreur inconnue'))
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // Navigation handlers
  // ============================================

  const openFormation = (f: Formation) => {
    setSelectedFormationId(f.id)
    setSelectedAccessType(f.access_type)
    const config = getCategoryConfig(f.category)
    setSequenceGradient(config.gradient)
    setViewMode('formation')
  }

  const openSequence = (seq: Sequence) => {
    setSelectedSequence(seq)
    setViewMode('sequence')
  }

  const goBack = () => {
    if (viewMode === 'sequence') {
      setSelectedSequence(null)
      setViewMode('formation')
    } else if (viewMode === 'formation') {
      setSelectedFormationId(null)
      setViewMode('theme')
    }
  }

  const handleSequenceComplete = async (score: number, totalPoints: number) => {
    if (selectedSequence) {
      markCompleted(selectedSequence.id, selectedSequence.sequence_number + 1)
    }
    try {
      await fetch('/api/streaks/update', { method: 'POST' })
    } catch (err) {
      console.error('Error updating streak:', err)
    }
    setSelectedSequence(null)
    setViewMode('formation')
  }

  // ============================================
  // EPP Status helpers
  // ============================================

  const getEppStatus = () => {
    const t1 = eppSessions.find(s => s.tour === 1)
    const t2 = eppSessions.find(s => s.tour === 2)

    if (t2?.completed_at) return { status: 'completed', label: 'EPP validée', color: 'green' }
    if (t1?.completed_at) return { status: 't1_done', label: 'T1 terminé — T2 en attente', color: 'amber' }
    if (t1) return { status: 't1_started', label: 'T1 en cours', color: 'blue' }
    return { status: 'not_started', label: 'Non commencé', color: 'gray' }
  }

  // ============================================
  // RENDU — Sequence Player
  // ============================================
  if (viewMode === 'sequence' && selectedSequence) {
    return (
      <SequencePlayer
        sequence={selectedSequence}
        categoryGradient={sequenceGradient}
        coverImageUrl={formations.find(f => f.id === selectedFormationId)?.cover_image_url}
        onBack={goBack}
        onComplete={handleSequenceComplete}
      />
    )
  }

  // ============================================
  // RENDU — Formation Detail
  // ============================================
  if (viewMode === 'formation' && selectedFormationId) {
    return (
      <FormationDetail
        formationId={selectedFormationId}
        onBack={goBack}
        onStartSequence={openSequence}
      />
    )
  }

  // ============================================
  // RENDU — Theme page
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F0F0F' }}>
        <Loader2 className="w-8 h-8 animate-spin text-[#2D1B96]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0F0F0F' }}>
        <div className="text-center">
          <p className="text-red-500 mb-4">Erreur : {error.message}</p>
          <button
            onClick={() => router.push('/formation')}
            className="px-4 py-2 bg-[#242424] rounded-xl text-sm text-[#e5e5e5]"
          >
            Retour aux thématiques
          </button>
        </div>
      </div>
    )
  }

  const eppStatus = getEppStatus()

  return (
    <>
      <header className="sticky top-0 z-30" style={{ background: '#1a1a1a', borderBottom: '0.5px solid #2a2a2a' }}>
        <div className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(fromPage)}
              className="p-2 -ml-2 hover:bg-[#242424] rounded-xl transition-colors"
            >
              <ChevronLeft size={20} className="text-gray-300" />
            </button>
            <h1 className="text-lg font-bold text-white">{themeConfig.label}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-6 space-y-6 min-h-screen" style={{ background: '#0F0F0F' }}>

        {/* ============================================ */}
        {/* SECTION 1 : Formation gamifiée (Axe 1) */}
        {/* ============================================ */}
        {formations.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-white mb-3">
              Formation — Axe 1
            </h2>

            <div className="relative">
              <button
                onClick={formationsScrollLeft}
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4
                           z-10 w-10 h-10 rounded-full bg-[#242424] shadow-md
                           items-center justify-center text-gray-300 hover:bg-[#2e2e2e]"
              >
                <ChevronLeft size={20} />
              </button>

              <div
                ref={formationsScrollRef}
                className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2 snap-x snap-mandatory"
              >
                {formations.map((f) => (
                  <FormationCardOverlay
                    key={f.id}
                    formation={f}
                    progress={formationProgress[f.id]}
                    onClick={() => openFormation(f)}
                  />
                ))}
              </div>

              <button
                onClick={formationsScrollRight}
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4
                           z-10 w-10 h-10 rounded-full bg-[#242424] shadow-md
                           items-center justify-center text-gray-300 hover:bg-[#2e2e2e]"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </section>
        )}

        {/* ============================================ */}
        {/* SECTION 2 : Audit EPP (Axe 2) */}
        {/* ============================================ */}
        <section>
          <h2 className="text-lg font-bold text-white mb-3">
            EPP — Axe 2
          </h2>

          {eppAudit ? (
            (() => {
              const eppT1 = eppSessions.find(s => s.tour === 1)
              const eppT2 = eppSessions.find(s => s.tour === 2)
              const isValidated = !!eppT2?.completed_at
              const isT2 = !!eppT2 && !eppT2.completed_at
              const ctaLabel = eppStatus.status === 'not_started'
                ? "Commencer l'audit"
                : isValidated
                ? 'Voir attestation'
                : "Continuer l'audit"
              const subtitle = isValidated
                ? 'validé'
                : isT2
                ? 'Tour 2 en cours'
                : eppT1?.completed_at
                ? 'Tour 1 terminé'
                : ''

              return (
                <DemarcheCard
                  demarche={{
                    id: eppAudit.id,
                    type: 'epp',
                    title: eppAudit.title,
                    subtitle,
                    badge: '',
                    badgeColor: '',
                    accentColor: '',
                    ctaUrl: `/formation/${themeSlug}/epp`,
                    ctaLabel,
                    category: themeSlug,
                  }}
                />
              )
            })()
          ) : (
            <div className="rounded-2xl p-4 opacity-60" style={{ background: '#242424', border: '0.5px solid #333' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#333] flex items-center justify-center shrink-0">
                  <Lock size={20} className="text-gray-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#6b7280] text-sm">Audit EPP</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Bientôt disponible pour cette thématique</p>
                </div>
              </div>
            </div>
          )}
        </section>

      </main>
    </>
  )
}
