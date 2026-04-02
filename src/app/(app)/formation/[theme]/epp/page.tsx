'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  ClipboardCheck,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Info,
  Minus,
  Plus,
  PauseCircle,
  Lock,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

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
}

interface EppCriterion {
  id: string
  code: string
  type: 'R' | 'P' | 'S'
  label: string
  source: string
  sort_order: number
}

interface UserEppSession {
  id: string
  tour: number
  started_at: string
  completed_at: string | null
  score_global: number | null
  nb_dossiers: number | null
  plan_actions: Record<string, { text: string; checked_suggestion_ids: string[] }> | null
}

interface EppSuggestion {
  id: string
  criterion_id: string
  sort_order: number
  text: string
  sequence_ref: string | null
}

// ============================================
// THEMES CONFIG
// ============================================

const THEMES_CONFIG: Record<string, { label: string; icon: string }> = {
  'esthetique': { label: 'Esthétique Dentaire', icon: '✨' },
  'restauratrice': { label: 'Dentisterie Restauratrice', icon: '🦷' },
  'endodontie': { label: 'Endodontie', icon: '🔬' },
  'chirurgie': { label: 'Chirurgie Orale', icon: '🔪' },
  'implant': { label: 'Implantologie', icon: '🔩' },
  'prothese': { label: 'Prothèse', icon: '👄' },
  'parodontologie': { label: 'Parodontologie', icon: '🫧' },
  'radiologie': { label: 'Radiologie', icon: '📡' },
  'ergonomie': { label: 'Ergonomie', icon: '🪑' },
  'relation-patient': { label: 'Relation Patient', icon: '🤝' },
  'sante-pro': { label: 'Santé du Praticien', icon: '💚' },
  'numerique': { label: 'Numérique & IA', icon: '🤖' },
  'environnement': { label: 'Environnement', icon: '🌿' },
  'management': { label: 'Management', icon: '💼' },
  'organisation': { label: 'Organisation', icon: '📋' },
  'soft-skills': { label: 'Soft Skills', icon: '🤝' },
}

// ============================================
// EPP PAGE — État 1 : Présentation
// ============================================

export default function EppPage() {
  const params = useParams<{ theme: string }>()
  const router = useRouter()
  const themeSlug = params.theme

  const [audit, setAudit] = useState<EppAudit | null>(null)
  const [criteria, setCriteria] = useState<EppCriterion[]>([])
  const [sessions, setSessions] = useState<UserEppSession[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // State machine
  type EppState = 'presentation' | 'saisie' | 'resultats'
  const [eppState, setEppState] = useState<EppState>('presentation')

  // Session active (évite la race condition setSessions/setEppState)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  // État 2 — Saisie
  const [nbDossiers, setNbDossiers] = useState<number>(10)
  const [currentDossier, setCurrentDossier] = useState<number>(1)
  const [responses, setResponses] = useState<Record<string, Record<string, 'oui' | 'non' | 'na'>>>({})
  const [savingDossier, setSavingDossier] = useState(false)
  const [dossierChoiceConfirmed, setDossierChoiceConfirmed] = useState(false)

  // État 3 — Résultats
  const [planActions, setPlanActions] = useState<Record<string, string>>({})
  const [savingPlan, setSavingPlan] = useState(false)
  const [planSaved, setPlanSaved] = useState(false)
  const [suggestions, setSuggestions] = useState<Record<string, EppSuggestion[]>>({})
  const [checkedSuggestions, setCheckedSuggestions] = useState<Record<string, string[]>>({})

  const themeConfig = THEMES_CONFIG[themeSlug] || { label: themeSlug, icon: '📚' }

  useEffect(() => {
    loadData()
  }, [themeSlug])

  const loadData = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // 1. Charger l'audit EPP de cette thématique
      const { data: auditData, error: aErr } = await supabase
        .from('epp_audits')
        .select('*')
        .eq('theme_slug', themeSlug)
        .eq('is_published', true)
        .limit(1)
        .maybeSingle()

      if (aErr) throw aErr

      if (!auditData) {
        setError('Aucun audit EPP disponible pour cette thématique')
        setLoading(false)
        return
      }

      setAudit(auditData)

      // 2. Charger les critères
      const { data: criteriaData, error: cErr } = await supabase
        .from('epp_criteria')
        .select('*')
        .eq('audit_id', auditData.id)
        .order('sort_order')

      if (cErr) throw cErr
      setCriteria(criteriaData || [])

      // 2b. Charger les suggestions d'amélioration
      if (criteriaData && criteriaData.length > 0) {
        const criteriaIds = criteriaData.map((c: EppCriterion) => c.id)
        const { data: suggestionsData } = await supabase
          .from('epp_improvement_suggestions')
          .select('*')
          .in('criterion_id', criteriaIds)
          .order('sort_order')

        if (suggestionsData) {
          const grouped: Record<string, EppSuggestion[]> = {}
          suggestionsData.forEach((s: EppSuggestion) => {
            if (!grouped[s.criterion_id]) grouped[s.criterion_id] = []
            grouped[s.criterion_id].push(s)
          })
          setSuggestions(grouped)
        }
      }

      // 3. Charger les sessions utilisateur
      if (user) {
        const { data: sessionsData } = await supabase
          .from('user_epp_sessions')
          .select('id, tour, started_at, completed_at, score_global, nb_dossiers, plan_actions')
          .eq('user_id', user.id)
          .eq('audit_id', auditData.id)
          .order('tour')

        if (sessionsData) {
          setSessions(sessionsData)

          // Restaurer le plan d'actions sauvegardé
          const completedT1 = sessionsData.find(
            (s: UserEppSession) => s.tour === 1 && s.completed_at
          )
          if (completedT1?.plan_actions) {
            const saved = completedT1.plan_actions
            const restoredText: Record<string, string> = {}
            const restoredChecked: Record<string, string[]> = {}
            Object.entries(saved).forEach(([code, val]) => {
              const v = val as { text: string; checked_suggestion_ids: string[] }
              restoredText[code] = v.text || ''
              restoredChecked[code] = v.checked_suggestion_ids || []
            })
            setPlanActions(restoredText)
            setCheckedSuggestions(restoredChecked)
          }

          const t1 = sessionsData.find(s => s.tour === 1)
          if (t1) {
            setActiveSessionId(t1.id)

            // Charger les réponses existantes
            const { data: respData } = await supabase
              .from('user_epp_responses')
              .select('dossier_number, criterion_id, response')
              .eq('session_id', t1.id)

            if (respData && respData.length > 0) {
              const loaded: Record<string, Record<string, 'oui' | 'non' | 'na'>> = {}
              for (const r of respData) {
                const key = String(r.dossier_number)
                if (!loaded[key]) loaded[key] = {}
                loaded[key][r.criterion_id] = r.response as 'oui' | 'non' | 'na'
              }
              setResponses(loaded)

              if (t1.completed_at) {
                // T1 terminé → résultats
                setEppState('resultats')
              } else {
                // T1 en cours → préparer la reprise (rester sur présentation pour voir la card "Reprendre")
                const maxDossier = Math.max(...respData.map(r => r.dossier_number))
                const cLen = (criteriaData || []).length
                const lastComplete = cLen > 0 &&
                  Object.keys(loaded[String(maxDossier)] || {}).length >= cLen
                setCurrentDossier(lastComplete ? maxDossier + 1 : maxDossier)
                if (t1.nb_dossiers) setNbDossiers(t1.nb_dossiers)
                setDossierChoiceConfirmed(true)
                // Rester sur 'presentation' pour afficher la card de reprise
              }
            } else if (!t1.completed_at) {
              // Session en cours sans réponses
              if (t1.nb_dossiers) {
                setNbDossiers(t1.nb_dossiers)
                setDossierChoiceConfirmed(true)
              }
              // Rester sur 'presentation'
            } else {
              // T1 terminé sans réponses (edge case)
              setEppState('resultats')
            }
          }
        }
      }
    } catch (err) {
      console.error('Erreur loadData EPP:', err)
      setError('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  const startT1 = async () => {
    if (!audit) return
    setStarting(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setError('Connectez-vous pour démarrer un audit')
        setStarting(false)
        return
      }

      const { data: session, error: sErr } = await supabase
        .from('user_epp_sessions')
        .insert({
          user_id: user.id,
          audit_id: audit.id,
          tour: 1,
        })
        .select()
        .single()

      if (sErr) throw sErr

      if (session) {
        setActiveSessionId(session.id)
        setSessions(prev => [...prev, session])
        setEppState('saisie')
      }
    } catch (err) {
      console.error('Erreur startT1:', err)
      setError('Erreur lors du démarrage')
    } finally {
      setStarting(false)
    }
  }

  const startT2 = async () => {
    if (!audit) return
    setStarting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: session, error: sErr } = await supabase
        .from('user_epp_sessions')
        .insert({
          user_id: user.id,
          audit_id: audit.id,
          tour: 2,
        })
        .select()
        .single()

      if (sErr) throw sErr
      if (session) {
        setActiveSessionId(session.id)
        setSessions(prev => [...prev, session])
        setResponses({})
        setCurrentDossier(1)
        setDossierChoiceConfirmed(false)
        setEppState('saisie')
      }
    } catch (err) {
      console.error('Erreur startT2:', err)
    } finally {
      setStarting(false)
    }
  }

  // ============================================
  // État 2 — Fonctions de saisie
  // ============================================

  const setResponse = (criterionId: string, value: 'oui' | 'non' | 'na') => {
    const key = String(currentDossier)
    setResponses(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [criterionId]: value }
    }))
  }

  const currentResponses = responses[String(currentDossier)] || {}
  const answeredCount = Object.keys(currentResponses).length
  const allAnswered = criteria.length > 0 && answeredCount >= criteria.length
  const isLastDossier = currentDossier >= nbDossiers

  const saveDossierResponses = async (dossierNumber: number, partial = false) => {
    const sessionId = activeSessionId || t1Session?.id
    if (!sessionId) return
    const dossierResp = responses[String(dossierNumber)]
    if (!dossierResp) return

    const supabase = createClient()

    // Supprimer les réponses existantes pour ce dossier (évite les doublons)
    await supabase
      .from('user_epp_responses')
      .delete()
      .eq('session_id', sessionId)
      .eq('dossier_number', dossierNumber)

    // Insérer les réponses (toutes si complet, sinon seulement celles définies)
    const rows = criteria
      .filter(c => dossierResp[c.id] !== undefined)
      .map(c => ({
        session_id: sessionId,
        dossier_number: dossierNumber,
        criterion_id: c.id,
        response: dossierResp[c.id]
      }))

    if (rows.length > 0) {
      const { error: insertErr } = await supabase.from('user_epp_responses').insert(rows)
      if (insertErr) console.error('Erreur save responses:', insertErr)
    }
  }

  const goNextDossier = async () => {
    setSavingDossier(true)
    try {
      await saveDossierResponses(currentDossier)
      setCurrentDossier(prev => prev + 1)
    } finally {
      setSavingDossier(false)
    }
  }

  const finishT1 = async () => {
    if (!activeSessionId) return
    setSavingDossier(true)
    try {
      // 1. Sauvegarder les réponses du dernier dossier
      await saveDossierResponses(currentDossier)

      // 2. Calculer le score global
      let totalOui = 0, totalNon = 0
      Object.values(responses).forEach(dossier => {
        Object.values(dossier).forEach(v => {
          if (v === 'oui') totalOui++
          else if (v === 'non') totalNon++
        })
      })
      // Inclure le dossier courant (déjà dans responses via setResponse)
      const scoreGlobal = totalOui + totalNon > 0
        ? Math.round((totalOui / (totalOui + totalNon)) * 100)
        : 0

      // 3. Mettre à jour user_epp_sessions
      const supabase = createClient()
      await supabase
        .from('user_epp_sessions')
        .update({
          completed_at: new Date().toISOString(),
          nb_dossiers: nbDossiers,
          score_global: scoreGlobal
        })
        .eq('id', activeSessionId)

      // 4. Recharger les sessions et aller aux résultats
      await loadData()
    } catch (err) {
      console.error('Erreur finishT1:', err)
    } finally {
      setSavingDossier(false)
    }
  }

  const pauseAudit = async () => {
    setSavingDossier(true)
    try {
      // Sauvegarder le dossier en cours (même partiel)
      await saveDossierResponses(currentDossier, true)
      // Sauvegarder nb_dossiers dans user_epp_sessions
      const sessionId = activeSessionId || t1Session?.id
      if (sessionId) {
        const supabase = createClient()
        await supabase
          .from('user_epp_sessions')
          .update({ nb_dossiers: nbDossiers })
          .eq('id', sessionId)
      }
      setEppState('presentation')
    } finally {
      setSavingDossier(false)
    }
  }

  const toggleSuggestion = (criterionCode: string, suggestionId: string) => {
    setCheckedSuggestions(prev => {
      const current = prev[criterionCode] || []
      return {
        ...prev,
        [criterionCode]: current.includes(suggestionId)
          ? current.filter(id => id !== suggestionId)
          : [...current, suggestionId]
      }
    })
  }

  // Sauvegarder le plan d'actions
  const savePlanActions = async () => {
    const sessionId = activeSessionId || t1Session?.id
    if (!sessionId) return
    setSavingPlan(true)
    try {
      const supabase = createClient()
      const fullPlan: Record<string, { text: string; checked_suggestion_ids: string[] }> = {}
      Object.keys({ ...planActions, ...checkedSuggestions }).forEach(code => {
        fullPlan[code] = {
          text: planActions[code] || '',
          checked_suggestion_ids: checkedSuggestions[code] || []
        }
      })
      const { error } = await supabase
        .from('user_epp_sessions')
        .update({ plan_actions: fullPlan })
        .eq('id', sessionId)
      if (!error) {
        setPlanSaved(true)
        setTimeout(() => setPlanSaved(false), 3000)
      }
    } catch (err) {
      console.error('Erreur savePlanActions:', err)
    } finally {
      setSavingPlan(false)
    }
  }

  const t1Session = sessions.find(s => s.tour === 1)
  const t2Session = sessions.find(s => s.tour === 2)

  const getT2Status = (): 'unavailable' | 'done' | 'in_progress' | 'unlocked' | { status: 'locked'; unlockDate: Date } => {
    if (!t1Session?.completed_at) return 'unavailable'
    if (t2Session?.completed_at) return 'done'
    if (t2Session && !t2Session.completed_at) return 'in_progress'

    const t1Date = new Date(t1Session.completed_at)
    const unlockDate = new Date(t1Date)
    unlockDate.setMonth(unlockDate.getMonth() + audit!.delai_t2_mois_min)

    const today = new Date()
    if (today >= unlockDate) return 'unlocked'
    return { status: 'locked', unlockDate }
  }

  const criteriaByType = {
    R: criteria.filter(c => c.type === 'R'),
    P: criteria.filter(c => c.type === 'P'),
    S: criteria.filter(c => c.type === 'S'),
  }

  // ============================================
  // RENDU
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0F7B6C]" />
      </div>
    )
  }

  if (error || !audit) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <ClipboardCheck size={48} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm mb-4">{error || 'Audit non trouvé'}</p>
          <Link
            href={`/formation/${themeSlug}`}
            className="px-4 py-2 bg-gray-100 rounded-xl text-sm text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Retour à la thématique
          </Link>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDU — État 2 : Saisie des dossiers
  // ============================================

  if (eppState === 'saisie') {
    // Étape 0 : Choix du nombre de dossiers
    if (!dossierChoiceConfirmed) {
      return (
        <>
          <header className="bg-white sticky top-0 z-30 shadow-sm">
            <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
              <button onClick={() => setEppState('presentation')} className="p-2 -ml-2 hover:bg-gray-50 rounded-xl transition-colors">
                <ChevronLeft size={20} className="text-gray-600" />
              </button>
              <h1 className="text-lg font-bold text-gray-900">Préparation T1</h1>
            </div>
          </header>
          <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
              <ClipboardCheck size={32} className="text-[#0F7B6C] mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Combien de dossiers allez-vous évaluer ?</h3>
              <p className="text-xs text-gray-400 mb-6">
                Entre {audit.nb_dossiers_min} et {audit.nb_dossiers_max} dossiers patients
              </p>
              <div className="flex items-center justify-center gap-4 mb-6">
                <button
                  onClick={() => setNbDossiers(prev => Math.max(audit.nb_dossiers_min, prev - 1))}
                  disabled={nbDossiers <= audit.nb_dossiers_min}
                  className="w-11 h-11 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 transition-colors"
                >
                  <Minus size={18} className="text-gray-600" />
                </button>
                <span className="text-4xl font-bold text-[#0F7B6C] w-16 text-center">{nbDossiers}</span>
                <button
                  onClick={() => setNbDossiers(prev => Math.min(audit.nb_dossiers_max, prev + 1))}
                  disabled={nbDossiers >= audit.nb_dossiers_max}
                  className="w-11 h-11 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 transition-colors"
                >
                  <Plus size={18} className="text-gray-600" />
                </button>
              </div>
              <button
                onClick={() => setDossierChoiceConfirmed(true)}
                className="w-full py-3 bg-[#0F7B6C] text-white text-sm font-semibold rounded-2xl hover:bg-[#0a5f54] transition-colors active:scale-[0.98]"
              >
                Commencer la saisie
              </button>
            </div>
          </main>
        </>
      )
    }

    // Grille de saisie
    return (
      <>
        <header className="bg-white sticky top-0 z-30 shadow-sm">
          <div className="max-w-lg mx-auto px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={pauseAudit}
                disabled={savingDossier}
                className="p-2 -ml-2 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <ChevronLeft size={20} className="text-gray-600" />
              </button>
              <span className="text-sm font-semibold text-gray-700">
                Dossier {currentDossier} / {nbDossiers}
              </span>
              <button
                onClick={pauseAudit}
                disabled={savingDossier}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
              >
                {savingDossier
                  ? <Loader2 size={12} className="animate-spin" />
                  : <PauseCircle size={14} />
                }
                {savingDossier ? 'Sauvegarde...' : 'Pause'}
              </button>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0F7B6C] rounded-full transition-all duration-300"
                style={{ width: `${(currentDossier / nbDossiers) * 100}%` }}
              />
            </div>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-4 space-y-3 pb-36">
          {criteria.map((c) => {
            const val = currentResponses[c.id]
            const typeBg = c.type === 'R' ? 'bg-purple-100 text-purple-700' :
                           c.type === 'P' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-start gap-2 mb-3">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${typeBg}`}>{c.code}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${typeBg}`}>{c.type}</span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-800 leading-snug">{c.label}</p>
                    {c.source && (
                      <p className="text-[10px] text-gray-400 mt-0.5">{c.source}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setResponse(c.id, 'oui')}
                    className={`flex-1 h-11 rounded-xl text-sm font-semibold border transition-colors ${
                      val === 'oui'
                        ? 'bg-green-500 text-white border-green-500'
                        : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                    }`}
                  >
                    OUI
                  </button>
                  <button
                    onClick={() => setResponse(c.id, 'non')}
                    className={`flex-1 h-11 rounded-xl text-sm font-semibold border transition-colors ${
                      val === 'non'
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                    }`}
                  >
                    NON
                  </button>
                  <button
                    onClick={() => setResponse(c.id, 'na')}
                    className={`flex-1 h-11 rounded-xl text-sm font-semibold border transition-colors ${
                      val === 'na'
                        ? 'bg-gray-400 text-white border-gray-400'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    NA
                  </button>
                </div>
              </div>
            )
          })}
        </main>

        {/* Pied de page fixe */}
        <div className="fixed left-0 right-0 bg-white border-t border-gray-100 p-4 z-30" style={{ bottom: '64px' }}>
          <div className="max-w-lg mx-auto">
            <p className="text-xs text-gray-400 text-center mb-2">
              {answeredCount} critères évalués sur {criteria.length}
            </p>
            {isLastDossier ? (
              <button
                onClick={finishT1}
                disabled={!allAnswered || savingDossier}
                className="w-full py-3 bg-[#0F7B6C] text-white text-sm font-semibold rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2 transition-colors hover:bg-[#0a5f54] active:scale-[0.98]"
              >
                {savingDossier ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Terminer et voir les résultats
              </button>
            ) : (
              <button
                onClick={goNextDossier}
                disabled={!allAnswered || savingDossier}
                className="w-full py-3 bg-[#0F7B6C] text-white text-sm font-semibold rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2 transition-colors hover:bg-[#0a5f54] active:scale-[0.98]"
              >
                {savingDossier ? <Loader2 size={16} className="animate-spin" /> : null}
                Dossier suivant
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </>
    )
  }

  // ============================================
  // RENDU — État 3 : Résultats T1
  // ============================================

  if (eppState === 'resultats' && t1Session?.completed_at) {
    // Calculs résultats par critère
    const criteriaStats = criteria.map(c => {
      let oui = 0, non = 0, na = 0
      Object.entries(responses).forEach(([, dossier]) => {
        const r = dossier[c.id]
        if (r === 'oui') oui++
        else if (r === 'non') non++
        else if (r === 'na') na++
      })
      const pct = oui + non > 0 ? Math.round((oui / (oui + non)) * 100) : null
      return { ...c, oui, non, na, pct }
    })

    const score = t1Session.score_global || 0
    const scoreColor = score >= 80 ? '#16A34A' : score >= 60 ? '#D97706' : '#DC2626'
    const circumference = 2 * Math.PI * 40
    const dash = (score / 100) * circumference

    const weakCriteria = criteriaStats.filter(c => c.pct !== null && c.pct < 80)
      .sort((a, b) => (a.pct || 0) - (b.pct || 0))

    return (
      <>
        <header className="bg-white sticky top-0 z-30 shadow-sm">
          <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
            <button onClick={() => setEppState('presentation')} className="p-2 -ml-2 hover:bg-gray-50 rounded-xl transition-colors">
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Résultats Tour 1</h1>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-6 space-y-4">

          {/* Score global */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center">
            <p className="text-sm font-semibold text-gray-500 mb-4">Score de conformité T1</p>
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#F3F4F6" strokeWidth="10" />
              <circle
                cx="50" cy="50" r="40" fill="none"
                stroke={scoreColor} strokeWidth="10"
                strokeDasharray={`${dash} ${circumference}`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
              <text x="50" y="50" textAnchor="middle" dominantBaseline="central"
                fontSize="20" fontWeight="bold" fill={scoreColor}>
                {score.toFixed(0)}%
              </text>
            </svg>
            <p className="text-xs text-gray-400 mt-2">
              sur {t1Session.nb_dossiers} dossiers évalués
            </p>
          </div>

          {/* Résultats par critère */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">Détail par critère</h3>
            </div>
            {criteriaStats.map(c => {
              const rowBg = c.pct === null ? '' :
                c.pct >= 80 ? 'bg-green-50' :
                c.pct >= 60 ? 'bg-orange-50' : 'bg-red-50'
              const pctColor = c.pct === null ? 'text-gray-400' :
                c.pct >= 80 ? 'text-green-700' :
                c.pct >= 60 ? 'text-orange-600' : 'text-red-600'
              const typeBg = c.type === 'R' ? 'bg-purple-100 text-purple-700' :
                             c.type === 'P' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
              return (
                <div key={c.id} className={`px-4 py-3 border-b border-gray-50 last:border-0 ${rowBg}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${typeBg}`}>{c.code}</span>
                    <p className="text-xs text-gray-700 flex-1 leading-snug">{c.label}</p>
                    <span className={`text-sm font-bold ${pctColor}`}>
                      {c.pct !== null ? `${c.pct}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex gap-3 text-[10px] text-gray-400 ml-7">
                    <span className="text-green-600">{c.oui} OUI</span>
                    <span className="text-red-500">{c.non} NON</span>
                    {c.na > 0 && <span>— {c.na} NA</span>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Plan d'actions */}
          {weakCriteria.length > 0 && (
            <div className="bg-white rounded-2xl border border-orange-100 p-4">
              <h3 className="font-semibold text-gray-900 text-sm mb-1">
                Axes d&apos;amélioration prioritaires
              </h3>
              <p className="text-xs text-gray-400 mb-3">
                Critères en dessous de 80% — notez vos actions correctives
              </p>
              <div className="space-y-4">
                {weakCriteria.map(c => {
                  const criterionSuggestions = suggestions[c.id] || []
                  const checked = checkedSuggestions[c.code] || []
                  return (
                    <div key={c.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">{c.code}</span>
                        <span className="text-xs text-gray-600">{c.pct}% de conformité</span>
                      </div>
                      {criterionSuggestions.length > 0 && (
                        <div className="space-y-1.5 mb-2">
                          {criterionSuggestions.map(s => (
                            <button
                              key={s.id}
                              onClick={() => toggleSuggestion(c.code, s.id)}
                              className={`w-full flex items-start gap-2 text-left px-3 py-2 rounded-xl border text-xs transition-colors ${
                                checked.includes(s.id)
                                  ? 'bg-teal-50 border-teal-300 text-teal-800'
                                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              <span className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                                checked.includes(s.id)
                                  ? 'bg-[#0F7B6C] border-[#0F7B6C] text-white'
                                  : 'border-gray-300'
                              }`}>
                                {checked.includes(s.id) && <CheckCircle2 size={10} />}
                              </span>
                              <span className="flex-1">
                                {s.text}
                                {s.sequence_ref && (
                                  <span className="block text-[10px] text-teal-500 italic mt-0.5">{s.sequence_ref}</span>
                                )}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      <textarea
                        rows={2}
                        placeholder="Action corrective personnalisée..."
                        value={planActions[c.code] || ''}
                        onChange={e => setPlanActions(prev => ({ ...prev, [c.code]: e.target.value }))}
                        className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-teal-400"
                      />
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-gray-400 text-center mt-2 mb-1">
                Vos actions seront enregistrées dans votre dossier EPP
              </p>
              <button
                onClick={savePlanActions}
                disabled={savingPlan}
                className={`w-full mt-1 h-12 text-sm font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-all ${
                  planSaved
                    ? 'bg-green-500 text-white'
                    : 'bg-[#0F7B6C] text-white hover:bg-[#0a5f54]'
                }`}
              >
                {savingPlan ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : planSaved ? (
                  <>
                    <CheckCircle2 size={16} />
                    Plan sauvegardé !
                  </>
                ) : (
                  'Sauvegarder le plan d\'actions'
                )}
              </button>
            </div>
          )}

          {/* Conclusion */}
          <div className="bg-teal-50 rounded-2xl border border-teal-100 p-4 text-center">
            <CheckCircle2 size={32} className="text-teal-600 mx-auto mb-2" />
            <p className="font-semibold text-teal-800 mb-1">Tour 1 complété !</p>
            <p className="text-xs text-teal-600 mb-4">
              Mettez en place vos actions d&apos;amélioration, puis revenez dans{' '}
              {audit.delai_t2_mois_min} à {audit.delai_t2_mois_max} mois pour le Tour 2.
            </p>
            <Link
              href={`/formation/${themeSlug}`}
              className="inline-block px-6 py-2.5 bg-[#0F7B6C] text-white text-sm font-semibold rounded-xl hover:bg-[#0a5f54] transition-colors"
            >
              Retour à la thématique
            </Link>
          </div>

        </main>
      </>
    )
  }

  // ============================================
  // RENDU — État 1 : Présentation
  // ============================================

  return (
    <>
      <header className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/formation/${themeSlug}`}
              className="p-2 -ml-2 hover:bg-gray-50 rounded-xl transition-colors"
            >
              <ChevronLeft size={20} className="text-gray-600" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
                <ClipboardCheck size={18} className="text-[#0F7B6C]" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">{audit.title}</h1>
                <p className="text-xs text-gray-400">
                  Audit EPP &middot; {themeConfig.icon} {themeConfig.label}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-6 space-y-4">

        {/* Description & objectifs */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{audit.description}</p>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <FileText size={14} />
              {audit.nb_dossiers_min}-{audit.nb_dossiers_max} dossiers
            </span>
            <span className="flex items-center gap-1">
              <Clock size={14} />
              Délai T2 : {audit.delai_t2_mois_min}-{audit.delai_t2_mois_max} mois
            </span>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-teal-50 rounded-2xl border border-teal-100 p-4">
          <div className="flex items-start gap-3">
            <Info size={18} className="text-teal-600 mt-0.5 shrink-0" />
            <div className="text-xs text-teal-700 leading-relaxed space-y-2">
              <p>
                <strong>Comment fonctionne cet audit EPP ?</strong>
              </p>
              <ol className="list-decimal list-inside space-y-1">
                <li>
                  <strong>Tour 1 (T1)</strong> — Évaluez votre pratique sur {audit.nb_dossiers_min} à {audit.nb_dossiers_max} dossiers
                  patients en répondant OUI / NON / NA pour chaque critère.
                </li>
                <li>
                  <strong>Actions d&apos;amélioration</strong> — Identifiez vos axes de progression et
                  mettez en place des changements dans votre pratique.
                </li>
                <li>
                  <strong>Tour 2 (T2)</strong> — Après un délai de {audit.delai_t2_mois_min} à {audit.delai_t2_mois_max} mois,
                  réévaluez vos dossiers pour mesurer l&apos;amélioration.
                </li>
              </ol>
              <p className="text-teal-600">
                La complétion des 2 tours valide l&apos;Axe 2 de votre Certification Périodique.
              </p>
            </div>
          </div>
        </div>

        {/* Statut Tours (si session existante) */}
        {(t1Session || t2Session) && (
          <div className="space-y-2">
            {/* Tour 1 status */}
            <div className={`bg-white rounded-2xl border p-3 ${
              t1Session?.completed_at ? 'border-green-200 bg-green-50/30' : 'border-gray-100'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  t1Session?.completed_at ? 'bg-green-100' : 'bg-teal-100'
                }`}>
                  {t1Session?.completed_at ? (
                    <CheckCircle2 size={16} className="text-green-600" />
                  ) : (
                    <span className="text-xs font-bold text-[#0F7B6C]">T1</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">Tour 1</p>
                  {t1Session?.completed_at ? (
                    <p className="text-[11px] text-green-600">
                      Score : {t1Session.score_global?.toFixed(0)}% &middot;
                      {' '}{new Date(t1Session.completed_at).toLocaleDateString('fr-FR')}
                    </p>
                  ) : (
                    <p className="text-[11px] text-blue-600">En cours</p>
                  )}
                </div>
              </div>
            </div>

            {/* Tour 2 status */}
            {(() => {
              const t2Status = getT2Status()
              if (t2Status === 'unavailable') return null

              const isLocked = typeof t2Status === 'object'
              const isUnlocked = t2Status === 'unlocked'
              const isInProgress = t2Status === 'in_progress'
              const isDone = t2Status === 'done'

              const unlockDate = isLocked ? t2Status.unlockDate : null
              const daysLeft = unlockDate
                ? Math.ceil((unlockDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : 0

              return (
                <div className={`bg-white rounded-2xl border p-4 ${
                  isDone ? 'border-green-200 bg-green-50/30' :
                  isUnlocked || isInProgress ? 'border-teal-200 bg-teal-50/30' :
                  'border-gray-100 opacity-80'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      isDone ? 'bg-green-100' :
                      isUnlocked || isInProgress ? 'bg-teal-100' :
                      'bg-gray-100'
                    }`}>
                      {isDone
                        ? <CheckCircle2 size={18} className="text-green-600" />
                        : isUnlocked || isInProgress
                          ? <span className="text-xs font-bold text-[#0F7B6C]">T2</span>
                          : <Lock size={16} className="text-gray-400" />
                      }
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">Tour 2</p>
                      {isDone && (
                        <p className="text-xs text-green-600">
                          Score : {t2Session!.score_global?.toFixed(0)}% &middot;{' '}
                          {new Date(t2Session!.completed_at!).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                      {isInProgress && (
                        <p className="text-xs text-blue-600">En cours</p>
                      )}
                      {isUnlocked && (
                        <p className="text-xs text-teal-600">
                          Disponible depuis le{' '}
                          {new Date(
                            new Date(t1Session!.completed_at!).getTime() +
                            audit!.delai_t2_mois_min * 30 * 24 * 60 * 60 * 1000
                          ).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                      {isLocked && (
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock size={10} />
                          Disponible dans {daysLeft} jour{daysLeft > 1 ? 's' : ''} &middot;
                          le {unlockDate!.toLocaleDateString('fr-FR')}
                        </p>
                      )}
                    </div>

                    {isUnlocked && (
                      <button
                        onClick={startT2}
                        disabled={starting}
                        className="px-3 py-1.5 bg-[#0F7B6C] text-white text-xs font-semibold rounded-xl hover:bg-[#0a5f54] transition-colors disabled:opacity-50"
                      >
                        Démarrer
                      </button>
                    )}
                    {isInProgress && (
                      <button
                        onClick={() => {
                          setDossierChoiceConfirmed(true)
                          setEppState('saisie')
                        }}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                      >
                        Reprendre
                      </button>
                    )}
                  </div>

                  {isLocked && t1Session?.completed_at && (
                    <div className="mt-3">
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-amber-400 h-1.5 rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.max(0,
                              ((Date.now() - new Date(t1Session.completed_at).getTime()) /
                              (unlockDate!.getTime() - new Date(t1Session.completed_at).getTime())) * 100
                            ))}%`
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">
                        Période d&apos;amélioration des pratiques en cours
                      </p>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* Reprise audit en cours */}
        {t1Session && !t1Session.completed_at && Object.keys(responses).length > 0 && (
          <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <PauseCircle size={18} className="text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-800">Audit en cours</p>
                <p className="text-xs text-blue-600">
                  Dossier {Math.max(currentDossier - 1, 0)} / {nbDossiers} complété{currentDossier - 1 > 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => {
                  setDossierChoiceConfirmed(true)
                  setEppState('saisie')
                }}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition-colors"
              >
                Reprendre
              </button>
            </div>
          </div>
        )}

        {/* Bouton voir résultats T1 */}
        {t1Session?.completed_at && !t2Session?.completed_at && (
          <button
            onClick={() => setEppState('resultats')}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#0F7B6C] text-white text-sm font-semibold rounded-2xl hover:bg-[#0a5f54] transition-colors active:scale-[0.98] shadow-sm"
          >
            <ClipboardCheck size={18} />
            Voir les résultats T1
          </button>
        )}

        {/* Critères d'évaluation */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">
            Critères d&apos;évaluation ({criteria.length})
          </h3>

          {/* Critères par type */}
          {(['R', 'P', 'S'] as const).map((type) => {
            const items = criteriaByType[type]
            if (items.length === 0) return null

            const typeLabel = type === 'R' ? 'Ressources' : type === 'P' ? 'Processus' : 'Résultats'
            const typeBg = type === 'R' ? 'bg-purple-100 text-purple-700' :
                           type === 'P' ? 'bg-blue-100 text-blue-700' :
                           'bg-green-100 text-green-700'

            return (
              <div key={type} className="mb-4 last:mb-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${typeBg}`}>
                    {type}
                  </span>
                  <span className="text-xs font-semibold text-gray-500">{typeLabel}</span>
                </div>
                <div className="space-y-1.5">
                  {items.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0"
                    >
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${typeBg}`}>
                        {c.code}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700">{c.label}</p>
                        {c.source && (
                          <p className="text-[10px] text-gray-400 mt-0.5">{c.source}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          <p className="text-[10px] text-gray-400 mt-3 pt-2 border-t border-gray-100">
            R = Ressources &middot; P = Processus &middot; S = Résultats
          </p>
        </div>

        {/* Bouton démarrer T1 */}
        {!t1Session && (
          <button
            onClick={startT1}
            disabled={starting}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#0F7B6C] text-white text-sm font-semibold rounded-2xl hover:bg-[#0a5f54] transition-colors active:scale-[0.98] disabled:opacity-50 shadow-sm"
          >
            {starting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Play size={18} />
            )}
            {starting ? 'Création de la session...' : 'Démarrer l\'audit T1'}
          </button>
        )}

        {/* Résultats si EPP complète */}
        {t1Session?.completed_at && t2Session?.completed_at && (
          <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-2xl border border-green-200 p-4">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle2 size={24} className="text-green-600" />
              <h3 className="font-bold text-green-800">EPP Validée !</h3>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">{t1Session.score_global?.toFixed(0)}%</p>
                <p className="text-xs text-gray-500">Score T1</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{t2Session.score_global?.toFixed(0)}%</p>
                <p className="text-xs text-gray-500">Score T2</p>
              </div>
              <div>
                <p className={`text-2xl font-bold ${
                  (t2Session.score_global || 0) >= (t1Session.score_global || 0) ? 'text-green-600' : 'text-red-600'
                }`}>
                  {((t2Session.score_global || 0) - (t1Session.score_global || 0) >= 0 ? '+' : '')}
                  {((t2Session.score_global || 0) - (t1Session.score_global || 0)).toFixed(0)}%
                </p>
                <p className="text-xs text-gray-500">Amélioration</p>
              </div>
            </div>
            <button className="w-full mt-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors">
              Télécharger l&apos;attestation EPP
            </button>
          </div>
        )}

      </main>
    </>
  )
}
