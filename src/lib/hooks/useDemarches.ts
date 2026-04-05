'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

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
            .select('id, title, slug, category, total_sequences')
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
            badgeColor: 'bg-[#2D1B96]',
            progress: pct,
            progressLabel: `${uf.current_sequence || 0}/${f.total_sequences || 15}`,
            ctaLabel: 'Continuer',
            ctaUrl: `/formation/${f.slug}`,
            accentColor: 'border-purple-200',
          }
        }).filter(Boolean) as DemarcheEnCours[]

        // =============================================
        // EPP — 2 requetes separees (pas de join)
        // =============================================

        // Etape 1 : sessions EPP non completees
        const { data: sessData, error: sessError } = await supabase
          .from('user_epp_sessions')
          .select('id, tour, started_at, audit_id')
          .eq('user_id', userId)
          .is('completed_at', null)
          .order('started_at', { ascending: false })
          .limit(2)

        console.log('[useDemarches] epp sessions raw:', sessData, sessError)

        // Etape 2 : details des audits associes
        const auditIds = sessData?.map(s => s.audit_id).filter(Boolean) || []
        let auditsDetails: any[] = []

        if (auditIds.length > 0) {
          const { data: aData, error: aError } = await supabase
            .from('epp_audits')
            .select('id, title, slug, theme_slug')
            .in('id', auditIds)

          console.log('[useDemarches] audits details:', aData, aError)
          auditsDetails = aData || []
        }

        // Etape 3 : construire les cartes EPP
        const eppCards = (sessData || []).map(session => {
          const audit = auditsDetails.find((a: any) => a.id === session.audit_id)
          if (!audit) return null
          return {
            id: session.id,
            type: 'epp' as const,
            title: audit.title,
            subtitle: `Tour ${session.tour} en cours \u00B7 Axe 2`,
            badge: 'EPP',
            badgeColor: 'bg-[#0F7B6C]',
            icon: '\u{1F4CB}',
            ctaLabel: "Continuer l'audit",
            ctaUrl: `/formation/${audit.theme_slug}/epp`,
            accentColor: 'border-teal-200',
          }
        }).filter(Boolean) as DemarcheEnCours[]

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
