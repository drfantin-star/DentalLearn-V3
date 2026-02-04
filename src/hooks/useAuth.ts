'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

// ============================================
// HOOK — Authentification utilisateur
// ============================================

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // Récupérer l'utilisateur actuel
    async function getUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      } catch (error) {
        console.error('Erreur auth:', error)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getUser()

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return { user, loading, isAuthenticated: !!user }
}

// ============================================
// HOOK — Vérifier si l'utilisateur est Premium
// ============================================

export function usePremiumStatus() {
  const { user, loading: authLoading } = useAuth()
  const [isPremium, setIsPremium] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    async function checkPremiumStatus() {
      if (!user) {
        setIsPremium(false)
        setLoading(false)
        return
      }

      try {
        const supabase = createClient()
        
        // TODO: Vérifier l'abonnement dans une table 'subscriptions' ou similaire
        // Pour l'instant, on considère que tous les utilisateurs connectés sont premium
        // en mode développement
        
        // const { data } = await supabase
        //   .from('subscriptions')
        //   .select('*')
        //   .eq('user_id', user.id)
        //   .eq('status', 'active')
        //   .maybeSingle()
        
        // setIsPremium(!!data)
        
        // Mode dev : tous les utilisateurs connectés sont "premium"
        setIsPremium(true)
      } catch (error) {
        console.error('Erreur vérification premium:', error)
        setIsPremium(false)
      } finally {
        setLoading(false)
      }
    }

    checkPremiumStatus()
  }, [user, authLoading])

  return { isPremium, loading: authLoading || loading }
}
