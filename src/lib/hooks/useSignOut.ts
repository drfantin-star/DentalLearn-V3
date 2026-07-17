'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/** Logique de déconnexion partagée (header home, /profil). */
export function useSignOut() {
  const router = useRouter()
  return async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }
}
