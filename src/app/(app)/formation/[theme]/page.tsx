'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Heart,
  Gamepad2,
  ClipboardCheck,
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle,
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
import FormationDetail from '@/components/formation/FormationDetail'
import SequencePlayer from '@/components/formation/SequencePlayer'

// ============================================
// THEMES CONFIG
// ============================================

const THEMES_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  'esthetique': { label: 'Esthétique Dentaire', icon: '✨', color: '#8B5CF6' },
  'restauratrice': { label: 'Dentisterie Restauratrice', icon: '🦷', color: '#F59E0B' },
  'endodontie': { label: 'Endodontie', icon: '🔬', color: '#6366F1' },
  'chirurgie': { label: 'Chirurgie Orale', icon: '🔪', color: '#EF4444' },
  'implant': { label: 'Implantologie', icon: '🔩', color: '#10B981' },
  'prothese': { label: 'Prothèse', icon: '👄', color: '#F97316' },
  'parodontologie': { label: 'Parodontologie', icon: '🫧', color: '#EC4899' },
  'radiologie': { label: 'Radiologie', icon: '📡', color: '#14B8A6' },
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
  const themeSlug = params.theme

  const [formations, setFormations] = useState<Formation[]>([])
  const [eppAudit, setEppAudit] = useState<EppAudit | null>(null)
  const [eppSessions, setEppSessions] = useState<UserEppSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // ViewMode pour la navigation interne (formation detail + sequence player)
  const [viewMode, setViewMode] = useState<ViewMode>('theme')
  const [selectedFormationId, setSelectedFormationId] = useState<string | null>(null)
  const [selectedAccessType, setSelectedAccessType] = useState<'demo' | 'full' | null>(null)
  const [selectedSequence, setSelectedSequence] = useState<Sequence | null>(null)
  const [sequenceGradient, setSequenceGradient] = useState<{ from: string; to: string }>({ from: '#8B5CF6', to: '#A78BFA' })

  const { markCompleted } = useUserFormationProgress(selectedFormationId, selectedAccessType)

  const themeConfig = getThemeConfig(themeSlug)

  useEffect(() => {
    loadData()
  }, [themeSlug])

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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2D1B96]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500 mb-4">Erreur : {error.message}</p>
          <button
            onClick={() => router.push('/formation')}
            className="px-4 py-2 bg-gray-100 rounded-xl text-sm"
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
      <header className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/formation"
              className="p-2 -ml-2 hover:bg-gray-50 rounded-xl transition-colors"
            >
              <ChevronLeft size={20} className="text-gray-600" />
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{themeConfig.icon}</span>
              <div>
                <h1 className="text-lg font-bold text-gray-900">{themeConfig.label}</h1>
                <p className="text-xs text-gray-400">
                  {formations.length} formation{formations.length > 1 ? 's' : ''}
                  {eppAudit ? ' • 1 audit EPP' : ''}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-6 space-y-6">

        {/* ============================================ */}
        {/* SECTION 1 : Formation gamifiée (Axe 1) */}
        {/* ============================================ */}
        {formations.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Gamepad2 size={18} className="text-purple-600" />
              <h2 className="text-base font-bold text-gray-900">Formation gamifiée</h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                Axe 1
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {formations.map((f) => {
                const config = getCategoryConfig(f.category)
                return (
                  <button
                    key={f.id}
                    onClick={() => openFormation(f)}
                    className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all text-left"
                  >
                    <div className={`w-10 h-10 rounded-xl ${config.bgColor} flex items-center justify-center shrink-0`}>
                      <span className="text-xl">{config.emoji}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <h3 className="font-semibold text-sm text-gray-800 truncate">
                          {f.title}
                        </h3>
                        {f.cp_eligible && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded border border-emerald-200">
                            CP
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-gray-400">
                        <span>{f.instructor_name}</span>
                        <span>{f.total_sequences} séq.</span>
                      </div>
                    </div>
                    {f.likes_count > 0 && (
                      <div className="flex items-center gap-1 text-pink-500 shrink-0 mr-1">
                        <Heart size={14} className="fill-pink-500" />
                        <span className="text-xs font-semibold">{f.likes_count}</span>
                      </div>
                    )}
                    <ChevronRight size={16} className="text-gray-300 shrink-0" />
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* ============================================ */}
        {/* SECTION 2 : Audit EPP (Axe 2) */}
        {/* ============================================ */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ClipboardCheck size={18} className="text-teal-600" />
            <h2 className="text-base font-bold text-gray-900">Audit EPP</h2>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
              Axe 2
            </span>
          </div>

          {eppAudit ? (
            <div className="bg-teal-50 rounded-2xl border border-teal-200 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
                  <ClipboardCheck size={20} className="text-teal-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm">{eppAudit.title}</h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{eppAudit.description}</p>

                  <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <FileText size={12} />
                      {eppAudit.nb_dossiers_min}-{eppAudit.nb_dossiers_max} dossiers
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      Délai T2 : {eppAudit.delai_t2_mois_min}-{eppAudit.delai_t2_mois_max} mois
                    </span>
                  </div>

                  {/* Statut EPP */}
                  <div className="flex items-center gap-2 mt-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      eppStatus.color === 'green' ? 'bg-green-100 text-green-700' :
                      eppStatus.color === 'amber' ? 'bg-amber-100 text-amber-700' :
                      eppStatus.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {eppStatus.color === 'green' && <CheckCircle2 size={10} className="inline mr-1" />}
                      {eppStatus.label}
                    </span>
                  </div>
                </div>
              </div>

              <Link
                href={`/formation/${themeSlug}/epp`}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-[#0F7B6C] text-white text-sm font-semibold rounded-xl hover:bg-[#0a5f54] transition-colors active:scale-[0.98]"
              >
                {eppStatus.status === 'not_started' ? 'Commencer l\'audit' :
                 eppStatus.status === 'completed' ? 'Voir les résultats' :
                 'Continuer l\'audit'}
                <ChevronRight size={16} />
              </Link>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 opacity-60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                  <Lock size={20} className="text-gray-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-500 text-sm">Audit EPP</h3>
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
