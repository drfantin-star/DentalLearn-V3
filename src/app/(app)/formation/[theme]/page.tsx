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
import { useEnrollmentStatus } from '@/lib/hooks/useEnrollmentStatus'
import { useMiniPlayerVisibility } from '@/context/MiniPlayerVisibilityContext'
import FormationDetail from '@/components/formation/FormationDetail'
import type { IntroSessionResult } from '@/components/formation/EnrollmentCTA'
import SequencePlayer from '@/components/formation/SequencePlayer'
import FormationCardOverlay from '@/components/home/FormationCardOverlay'
import DemarcheCard from '@/components/home/DemarcheCard'
import { getEppTourStatus, getEppCtaLabel } from '@/lib/epp/eppTourStatus'

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
  const [eppAudits, setEppAudits] = useState<EppAudit[]>([])
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

  // P4 : masque le mini-player flottant sur le detail formation. En 'sequence',
  // c'est SequencePlayer qui pilote la visibilite (il le re-affiche sur l'onglet
  // audio-seul enrichi - P5), donc on n'ecrit PAS ici pour ce viewMode afin de
  // ne pas ecraser sa decision. Reste visible sur la liste du theme. N'affecte
  // jamais l'audio (AudioContext intact).
  const { setSuppressed: setMiniPlayerSuppressed } = useMiniPlayerVisibility()
  useEffect(() => {
    if (viewMode === 'sequence') return
    setMiniPlayerSuppressed(viewMode === 'formation')
  }, [viewMode, setMiniPlayerSuppressed])

  const { markCompleted } = useUserFormationProgress(selectedFormationId)

  // Statut d'inscription — pour décider d'afficher la modal post-intro
  const { isEnrolled: isEnrolledForSelected } = useEnrollmentStatus(selectedFormationId)
  const wasEnrolledBeforeSequenceRef = useRef<boolean>(false)
  const [pendingPostIntroModal, setPendingPostIntroModal] = useState(false)
  // Résultat du quiz d'intro joué avant inscription, transmis à EnrollmentCTA
  // pour réconciliation (points + déblocage) au moment de l'inscription.
  const [introSessionResult, setIntroSessionResult] = useState<IntroSessionResult | null>(null)

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

      // 2. Charger les audits EPP de cette thématique (0, 1 ou plusieurs).
      //    Tri par date de création (le plus ancien en premier) pour un ordre
      //    d'affichage stable dans la grille.
      const { data: eppData } = await supabase
        .from('epp_audits')
        .select('*')
        .eq('theme_slug', themeSlug)
        .eq('is_published', true)
        .order('created_at', { ascending: true })

      setEppAudits(eppData || [])

      // 3. Charger les sessions EPP de l'utilisateur pour tous ces audits.
      if (user && eppData && eppData.length > 0) {
        const { data: sessionsData } = await supabase
          .from('user_epp_sessions')
          .select('id, audit_id, tour, started_at, completed_at, score_global')
          .eq('user_id', user.id)
          .in('audit_id', eppData.map((a: EppAudit) => a.id))
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
    wasEnrolledBeforeSequenceRef.current = isEnrolledForSelected
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

  // Fetch frais de l'inscription. Plus robuste qu'un snapshot d'état React
  // qui peut être stale (race condition sur useEnrollmentStatus, navigation
  // entre formations, désinscription SQL pendant que la page est ouverte).
  const fetchEnrolledFresh = async (formationId: string): Promise<boolean> => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { data } = await supabase
      .from('user_formations')
      .select('id')
      .eq('user_id', user.id)
      .eq('formation_id', formationId)
      .maybeSingle()
    return !!data
  }

  const buildShouldSubmitResult = (seq: Sequence) => async () => {
    if (!seq.is_intro) return true
    const enrolled = await fetchEnrolledFresh(seq.formation_id)
    return enrolled
  }

  // `score` reçoit en réalité correctCount (cf. SequencePlayer.onComplete).
  const handleSequenceComplete = async (correctCount: number, totalPoints: number) => {
    const completedSequence = selectedSequence
    if (!completedSequence) {
      setSelectedSequence(null)
      setViewMode('formation')
      return
    }

    const isCurrentlyEnrolled = await fetchEnrolledFresh(completedSequence.formation_id)
    const isIntroOfNonEnrolled = !!completedSequence.is_intro && !isCurrentlyEnrolled

    if (isIntroOfNonEnrolled) {
      // Garde inchangée : aucune écriture DB pour un non-inscrit. On mémorise le
      // résultat pour le réconcilier à l'inscription (points + déblocage).
      setIntroSessionResult({
        sequenceId: completedSequence.id,
        correctCount,
        totalPoints,
      })
      setSelectedSequence(null)
      setViewMode('formation')
      setPendingPostIntroModal(true)
      return
    }

    markCompleted(completedSequence.id, completedSequence.sequence_number + 1)

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

  // ============================================
  // RENDU — Sequence Player
  // ============================================
  if (viewMode === 'sequence' && selectedSequence) {
    return (
      <SequencePlayer
        sequence={selectedSequence}
        categoryGradient={sequenceGradient}
        coverImageUrl={formations.find(f => f.id === selectedFormationId)?.cover_image_url}
        formationTitle={formations.find(f => f.id === selectedFormationId)?.title ?? ''}
        onBack={goBack}
        onComplete={handleSequenceComplete}
        shouldSubmitResult={buildShouldSubmitResult(selectedSequence)}
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
        triggerPostIntroModal={pendingPostIntroModal}
        onPostIntroModalClose={() => setPendingPostIntroModal(false)}
        introSessionResult={introSessionResult}
      />
    )
  }

  // ============================================
  // RENDU — Theme page
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F0F0F' }}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
            className="px-4 py-2 glass-card rounded-xl text-sm text-white"
          >
            Retour aux thématiques
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <header className="sticky top-0 z-30" style={{ background: '#1a1a1a', borderBottom: '0.5px solid #2a2a2a' }}>
        <div className="max-w-lg mx-auto md:max-w-2xl lg:max-w-[1500px] px-4 md:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(fromPage)}
              className="p-2 -ml-2 hover:bg-[#242424] rounded-xl transition-colors"
            >
              <ChevronLeft size={20} className="text-white/70" />
            </button>
            <h1 className="text-lg font-bold text-white">{themeConfig.label}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto md:max-w-2xl lg:max-w-[1500px] px-4 md:px-6 lg:px-8 py-6 space-y-6 min-h-screen" style={{ background: '#0F0F0F' }}>

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
                           items-center justify-center text-white/70 hover:bg-[#2e2e2e]"
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
                    aspect="landscape"
                    size="large"
                    onClick={() => openFormation(f)}
                  />
                ))}
              </div>

              <button
                onClick={formationsScrollRight}
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4
                           z-10 w-10 h-10 rounded-full bg-[#242424] shadow-md
                           items-center justify-center text-white/70 hover:bg-[#2e2e2e]"
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

          {/* Grille 2 colonnes sur desktop — une carte par audit EPP publié.
              Mobile : 1 colonne (inchange). auto-rows-fr : hauteurs egales
              sur toutes les rangees a partir de 3 audits. justify-items-start :
              les tuiles gardent leur gabarit fixe (comme la tuile formation
              voisine), pas d'etirement pleine largeur dans leur cellule. */}
          <div className="grid gap-4 lg:grid-cols-2 lg:auto-rows-fr justify-items-start">
          {eppAudits.length > 0 ? (
            eppAudits.map((audit) => {
              const auditSessions = eppSessions.filter(s => s.audit_id === audit.id)
              const eppStatus = getEppTourStatus(auditSessions)
              const eppT1 = auditSessions.find(s => s.tour === 1)
              const ctaLabel = getEppCtaLabel(eppStatus)
              const subtitle = eppStatus === 'completed'
                ? 'validé'
                : eppStatus === 't2_in_progress'
                ? 'Tour 2 en cours'
                : eppT1?.completed_at
                ? 'Tour 1 terminé'
                : ''

              return (
                <DemarcheCard
                  key={audit.id}
                  demarche={{
                    id: audit.id,
                    type: 'epp',
                    title: audit.title,
                    subtitle,
                    badge: '',
                    badgeColor: '',
                    accentColor: '',
                    ctaUrl: `/formation/${themeSlug}/epp?audit=${audit.slug}`,
                    ctaLabel,
                    category: themeSlug,
                    eppStatus,
                  }}
                  size="large"
                />
              )
            })
          ) : (
            <div className="glass-card rounded-2xl p-4 opacity-60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#333] flex items-center justify-center shrink-0">
                  <Lock size={20} className="text-white/40" />
                </div>
                <div>
                  <h3 className="font-semibold text-white/55 text-sm">Audit EPP</h3>
                  <p className="text-xs text-white/40 mt-0.5">Bientôt disponible pour cette thématique</p>
                </div>
              </div>
            </div>
          )}
          </div>
        </section>

      </main>
    </>
  )
}
