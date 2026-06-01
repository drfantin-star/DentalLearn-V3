'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserInterests } from '@/lib/supabase/types'

// Écrit les centres d'intérêt déclarés dans user_profiles.interests via le
// client session-utilisateur (jamais service role). Couvert par la policy RLS
// UPDATE self existante (« Users can update own profile », auth.uid() = id).
// NULL → non-NULL marque l'onboarding comme « vu » (cf. gating auth/callback).
export function useSaveInterests() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saveInterests = useCallback(
    async (interests: UserInterests): Promise<boolean> => {
      setSaving(true)
      setError(null)

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('Utilisateur non authentifié')
        setSaving(false)
        return false
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ interests })
        .eq('id', user.id)

      setSaving(false)

      if (updateError) {
        setError(updateError.message)
        return false
      }

      return true
    },
    []
  )

  return { saveInterests, saving, error }
}
