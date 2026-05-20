'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useEnrollmentStatus(formationId: string | null) {
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchStatus = useCallback(async () => {
    if (!formationId) {
      setIsEnrolled(false)
      setLoading(false)
      return
    }

    const supabase = createClient()

    try {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setIsEnrolled(false)
        return
      }

      const { data, error } = await supabase
        .from('user_formations')
        .select('id')
        .eq('user_id', user.id)
        .eq('formation_id', formationId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        console.error('Erreur useEnrollmentStatus:', error)
        setIsEnrolled(false)
        return
      }

      setIsEnrolled(!!data)
    } catch (err) {
      console.error('Erreur useEnrollmentStatus:', err)
      setIsEnrolled(false)
    } finally {
      setLoading(false)
    }
  }, [formationId])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  return { isEnrolled, loading, refetch: fetchStatus }
}
