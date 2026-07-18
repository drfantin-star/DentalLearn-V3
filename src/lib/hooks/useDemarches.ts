'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getEppTourStatus, getEppCtaLabel, type EppTourStatus } from '@/lib/epp/eppTourStatus'

export interface DemarcheEnCours {
  id: string
  type: 'formation' | 'epp' | 'auto_evaluation' | 'prems'
  title: string
  subtitle: string
  badge: string
  badgeColor: string   // classe Tailwind bg-xxx
  icon?: string        // emoji ou nom icone
  progress?: number    // 0-100, optionnel
  progressLabel?: string
  ctaLabel: string
  ctaUrl: string
  accentColor: string  // classe Tailwind border-xxx
  coverImageUrl?: string | null
  category?: string | null
  eppStatus?: EppTourStatus  // uniquement pertinent quand type === 'epp'
}

export function useDemarches(userId?: string) {
  const [demarches, setDemarches] = useState<DemarcheEnCours[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    async function fetchDemarches() {
      const supabase = createClient()

      try {
        // =============================================
        // FORMATIONS — 2 requetes separees (pas de join)
        // =============================================

        // Etape 1 : inscriptions utilisateur
        const { data: ufData, error: ufError } = await supabase
          .from('user_formations')
          .select('id, formation_id, current_sequence, started_at')
          .eq('user_id', userId)
          .not('started_at', 'is', null)
          .order('started_at', { ascending: false })
          .limit(3)

        console.log('[useDemarches] uf raw:', ufData, ufError)

        // Etape 2 : details des formations
        const formationIds = ufData?.map(uf => uf.formation_id).filter(Boolean) || []
        let formationsDetails: any[] = []

        if (formationIds.length > 0) {
          const { data: fData, error: fError } = await supabase
            .from('formations')
            .select('id, title, slug, category, total_sequences, cover_image_url')
            .in('id', formationIds)
            .eq('is_published', true)

          console.log('[useDemarches] formations details:', fData, fError)
          formationsDetails = fData || []
        }

        // Etape 3 : construire les cartes formations
        const formationCards = (ufData || []).map(uf => {
          const f = formationsDetails.find((fd: any) => fd.id === uf.formation_id)
          if (!f) return null
          const pct = uf.current_sequence && f.total_sequences
            ? Math.round((uf.current_sequence / f.total_sequences) * 100)
            : 0
          return {
            id: uf.id,
            type: 'formation' as const,
            title: f.title,
            subtitle: f.category || 'Formation',
            badge: 'CP',
            badgeColor: 'bg-primary',
            progress: pct,
            progressLabel: `${uf.current_sequence || 0}/${f.total_sequences || 15}`,
            ctaLabel: 'Continuer',
            ctaUrl: `/formation/${f.category}?formation=${f.slug}`,
            accentColor: 'border-purple-200',
            coverImageUrl: f.cover_image_url || null,
            category: f.category || null,
          }
        }).filter(Boolean) as DemarcheEnCours[]

        // =============================================
        // EPP — audits en cours (T1 et/ou T2 non tous deux complétés)
        // =============================================

        // Toutes les sessions EPP de l'utilisateur, tours et états confondus —
        // le statut d'un audit ne peut se calculer correctement qu'en
        // regardant T1 ET T2 ensemble (cf. getEppTourStatus).
        const { data: allEppSessions, error: sessError } = await supabase
          .from('user_epp_sessions')
          .select('id, tour, started_at, completed_at, audit_id')
          .eq('user_id', userId)
          .order('started_at', { ascending: false })

        console.log('[useDemarches] epp sessions:', allEppSessions, sessError)

        // Regroupe par audit_id
        const sessionsByAudit = new Map<string, typeof allEppSessions>()
        for (const session of allEppSessions || []) {
          const list = sessionsByAudit.get(session.audit_id) || []
          list.push(session)
          sessionsByAudit.set(session.audit_id, list)
        }

        // Statut par audit, en excluant les audits entièrement complétés
        // (T1 + T2) — ce ne sont plus des "démarches en cours".
        const auditsEnCours: Array<{ auditId: string; status: EppTourStatus; latestSession: NonNullable<typeof allEppSessions>[number] }> = []
        sessionsByAudit.forEach((sessions, auditId) => {
          if (!sessions) return
          const status = getEppTourStatus(sessions)
          if (status === 'completed' || status === 'not_started') return
          const latestSession = [...sessions].sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''))[0]
          auditsEnCours.push({ auditId, status, latestSession })
        })

        // Les plus récemment actifs d'abord, limite à 2 (comme avant)
        auditsEnCours.sort((a, b) => {
          const aKey = a.latestSession.completed_at || a.latestSession.started_at || ''
          const bKey = b.latestSession.completed_at || b.latestSession.started_at || ''
          return bKey.localeCompare(aKey)
        })
        const auditsRetenus = auditsEnCours.slice(0, 2)

        // Charger les audits associés
        const auditIds = auditsRetenus.map(a => a.auditId)

        let auditsDetails: any[] = []

        if (auditIds.length > 0) {
          const { data: aData, error: aError } = await supabase
            .from('epp_audits')
            .select('id, title, slug, theme_slug')
            .in('id', auditIds)

          console.log('[useDemarches] audits details:', aData, aError)
          auditsDetails = aData || []
        }

        // Construire les cartes EPP
        const eppCards: DemarcheEnCours[] = []
        auditsRetenus.forEach(({ auditId, status: eppStatus, latestSession }) => {
          const audit = auditsDetails.find((a: any) => a.id === auditId)
          if (!audit) return

          const subtitle = eppStatus === 't1_done_waiting_t2'
            ? 'Tour 1 complété · En attente du Tour 2 · Axe 2'
            : eppStatus === 't2_in_progress'
              ? 'Tour 2 en cours · Axe 2'
              : 'Tour 1 en cours · Axe 2'

          eppCards.push({
            id: latestSession.id,
            type: 'epp',
            title: audit.title,
            subtitle,
            badge: 'EPP',
            badgeColor: 'bg-[#0F7B6C]',
            icon: '📋',
            ctaLabel: getEppCtaLabel(eppStatus),
            ctaUrl: `/formation/${audit.theme_slug}/epp?audit=${audit.slug}`,
            accentColor: 'border-teal-200',
            eppStatus,
          })
        })

        // =============================================
        // Combiner et limiter a 4
        // =============================================
        const allDemarches = [...formationCards, ...eppCards].slice(0, 4)

        console.log('[useDemarches] demarches finales:', allDemarches)

        // NOTE DEVELOPPEUR : Pour ajouter de nouveaux types de demarches
        // (auto-evaluation sante, PROMs/PREMs, etc.), ajouter une requete
        // supplementaire ici et pousser dans le tableau avant le slice.
        // Le reste du rendu s'adapte automatiquement.

        setDemarches(allDemarches)
      } catch (err) {
        console.error('[useDemarches] Erreur chargement demarches:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchDemarches()
  }, [userId])

  return { demarches, loading }
}
