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
      const result: DemarcheEnCours[] = []

      try {
        // 1. Formations gamifiees en cours (max 3)
        //    Jointure via l'alias "formation:formations(*)" qui est le pattern
        //    utilise partout dans le codebase (useFormations.ts, enrollments, etc.)
        const { data: formationsData, error: formationsError } = await supabase
          .from('user_formations')
          .select(`
            id, formation_id, current_sequence,
            formation:formations (id, title, slug, category, total_sequences)
          `)
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('started_at', { ascending: false })
          .limit(3)

        console.log('[useDemarches] formations query error:', formationsError)
        console.log('[useDemarches] formations data:', formationsData)

        // 2. Audits EPP en cours (T1 ou T2 non completes)
        //    Requete en deux temps car le FK audit_id -> epp_audits
        //    n'est pas toujours resolu par PostgREST en jointure imbriquee
        const { data: eppSessionsData, error: eppError } = await supabase
          .from('user_epp_sessions')
          .select('id, audit_id, tour, started_at')
          .eq('user_id', userId)
          .is('completed_at', null)
          .order('started_at', { ascending: false })
          .limit(2)

        console.log('[useDemarches] epp sessions error:', eppError)
        console.log('[useDemarches] epp sessions data:', eppSessionsData)

        // Requete 2b : details des audits EPP (si des sessions existent)
        let eppAuditsMap: Record<string, { id: string; title: string; slug: string; theme_slug: string }> = {}
        if (eppSessionsData && eppSessionsData.length > 0) {
          const auditIds = eppSessionsData.map(s => s.audit_id).filter(Boolean)
          if (auditIds.length > 0) {
            const { data: auditsData, error: auditsError } = await supabase
              .from('epp_audits')
              .select('id, title, slug, theme_slug')
              .in('id', auditIds)

            console.log('[useDemarches] epp audits error:', auditsError)
            console.log('[useDemarches] epp audits data:', auditsData)

            auditsData?.forEach(a => {
              eppAuditsMap[a.id] = a
            })
          }
        }

        // Formations gamifiees
        formationsData?.forEach(uf => {
          if (!uf.formation) return
          const f = uf.formation as any
          const pct = uf.current_sequence && f.total_sequences
            ? Math.round((uf.current_sequence / f.total_sequences) * 100)
            : 0
          result.push({
            id: uf.id,
            type: 'formation',
            title: f.title,
            subtitle: f.category || 'Formation',
            badge: 'CP',
            badgeColor: 'bg-[#2D1B96]',
            progress: pct,
            progressLabel: `${uf.current_sequence || 0}/${f.total_sequences || 15}`,
            ctaLabel: 'Continuer',
            ctaUrl: `/formation/${f.slug}`,
            accentColor: 'border-purple-200',
          })
        })

        // Audits EPP
        eppSessionsData?.forEach(session => {
          const audit = eppAuditsMap[session.audit_id]
          if (!audit) return
          result.push({
            id: session.id,
            type: 'epp',
            title: audit.title,
            subtitle: `Tour ${session.tour} en cours`,
            badge: 'EPP',
            badgeColor: 'bg-[#0F7B6C]',
            icon: '\u{1F4CB}',
            ctaLabel: "Continuer l'audit",
            ctaUrl: `/formation/${audit.theme_slug}/epp`,
            accentColor: 'border-teal-200',
          })
        })

        // NOTE DEVELOPPEUR : Pour ajouter de nouveaux types de demarches
        // (auto-evaluation sante, PROMs/PREMs, etc.), ajouter une requete
        // supplementaire ici et pousser dans le tableau result[].
        // Le reste du rendu s'adapte automatiquement.

        console.log('[useDemarches] demarches finales:', result)

        // Limiter a 4 au total
        setDemarches(result.slice(0, 4))
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
