'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ChevronLeft,
  Loader2,
  ClipboardCheck,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Info,
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

      // 3. Charger les sessions utilisateur
      if (user) {
        const { data: sessionsData } = await supabase
          .from('user_epp_sessions')
          .select('id, tour, started_at, completed_at, score_global, nb_dossiers')
          .eq('user_id', user.id)
          .eq('audit_id', auditData.id)
          .order('tour')

        if (sessionsData) setSessions(sessionsData)
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
        setSessions(prev => [...prev, session])
      }
    } catch (err) {
      console.error('Erreur startT1:', err)
      setError('Erreur lors du démarrage')
    } finally {
      setStarting(false)
    }
  }

  const t1Session = sessions.find(s => s.tour === 1)
  const t2Session = sessions.find(s => s.tour === 2)

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
            {t1Session?.completed_at && (
              <div className={`bg-white rounded-2xl border p-3 ${
                t2Session?.completed_at ? 'border-green-200 bg-green-50/30' :
                'border-gray-100 opacity-70'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    t2Session?.completed_at ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    {t2Session?.completed_at ? (
                      <CheckCircle2 size={16} className="text-green-600" />
                    ) : (
                      <span className="text-xs font-bold text-gray-400">T2</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">Tour 2</p>
                    {t2Session?.completed_at ? (
                      <p className="text-[11px] text-green-600">
                        Score : {t2Session.score_global?.toFixed(0)}% &middot;
                        {' '}{new Date(t2Session.completed_at).toLocaleDateString('fr-FR')}
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-600 flex items-center gap-1">
                        <AlertCircle size={10} />
                        En attente (délai minimum : {audit.delai_t2_mois_min} mois)
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
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
