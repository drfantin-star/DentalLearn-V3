'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AxeId } from './types'

// Compte léger des ressources d'un axe, pour la pastille du BibliothequeBanner
// dans les pages d'axe (client components). Renvoie undefined tant que la valeur
// n'est pas chargée — le banner masque alors la pastille.
export function useRessourceCount(axe: AxeId): number | undefined {
  const [count, setCount] = useState<number | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const supabase = createClient()
      const { count: c, error } = await supabase
        .from('bibliotheque_ressources')
        .select('id', { count: 'exact', head: true })
        .eq('axe', axe)
      if (cancelled) return
      if (error) {
        console.error('useRessourceCount error:', error.message)
        return
      }
      setCount(c ?? 0)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [axe])

  return count
}
