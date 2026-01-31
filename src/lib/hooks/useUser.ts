'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface UserProfile {
  id: string
  first_name: string | null
  last_name: string | null
  profile_photo_url: string | null
  city: string | null
  practice_type: string | null
}

interface Streak {
  current_streak: number
  longest_streak: number
  last_activity_date: string | null
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [streak, setStreak] = useState<Streak | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClient()

      try {
        // Récupérer l'utilisateur connecté
        const { data: { user: authUser } } = await supabase.auth.getUser()
        setUser(authUser)

        if (authUser) {
          // Récupérer le profil
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', authUser.id)
            .single()

          if (profileData) setProfile(profileData)

          // Récupérer le streak
          const { data: streakData } = await supabase
            .from('streaks')
            .select('current_streak, longest_streak, last_activity_date')
            .eq('user_id', authUser.id)
            .single()

          if (streakData) setStreak(streakData)
        }
      } catch (err) {
        console.error('Error fetching user:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()

    // Écouter les changements d'auth
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user || null)
        if (!session?.user) {
          setProfile(null)
          setStreak(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Nom d'affichage
  const displayName = profile?.first_name 
    ? `Dr. ${profile.first_name}` 
    : user?.email?.split('@')[0] || 'Utilisateur'

  return { 
    user, 
    profile, 
    streak, 
    loading, 
    displayName,
    isAuthenticated: !!user 
  }
}
