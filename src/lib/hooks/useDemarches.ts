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
        const { data: formationsData } = await supabase
          .from('user_formations')
          .select(`
            id, formation_id, current_sequence, progress,
            formations (id, title, slug, category, total_sequences, cover_image_url)
          `)
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .limit(3)

        // 2. Audits EPP en cours (T1 ou T2 non completes)
        const { data: eppData } = await supabase
          .from('user_epp_sessions')
          .select(`
            id, tour, started_at,
            epp_audits (id, title, slug, theme_slug)
          `)
          .eq('user_id', userId)
          .is('completed_at', null)
          .order('started_at', { ascending: false })
          .limit(2)

        // Formations gamifiees
        formationsData?.forEach(uf => {
          if (!uf.formations) return
          const f = uf.formations as any
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
        eppData?.forEach(session => {
          if (!session.epp_audits) return
          const audit = session.epp_audits as any
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

        // Limiter a 4 au total
        setDemarches(result.slice(0, 4))
      } catch (err) {
        console.error('Erreur chargement demarches:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchDemarches()
  }, [userId])

  return { demarches, loading }
}
