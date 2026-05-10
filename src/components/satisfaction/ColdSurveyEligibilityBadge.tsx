'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  formationId: string
}

interface EligibilityResult {
  is_eligible: boolean
  has_already_replied: boolean
  cold_survey_due_at: string | null
}

export function ColdSurveyEligibilityBadge({ formationId }: Props) {
  const [eligible, setEligible] = useState(false)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .rpc('check_cold_survey_eligibility', { p_formation_id: formationId })
          .single()
        if (cancelled) return
        if (error) return
        const e = data as EligibilityResult | null
        if (e && e.is_eligible && !e.has_already_replied) {
          setEligible(true)
        }
      } catch {
        // fail silent — badge optionnel
      }
    }
    check()
    return () => {
      cancelled = true
    }
  }, [formationId])

  if (!eligible) return null

  return (
    <Link
      href={`/satisfaction-froid/${formationId}`}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/40 hover:border-purple-400 text-sm text-purple-200 transition-colors"
    >
      <Sparkles className="w-4 h-4" />
      <span>Donnez votre avis, 3 mois après</span>
    </Link>
  )
}

export default ColdSurveyEligibilityBadge
