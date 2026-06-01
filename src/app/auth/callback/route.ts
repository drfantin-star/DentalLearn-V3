import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Gating onboarding « centres d'intérêt » (PR2a) : centralisé ici plutôt
      // qu'au middleware (décision : middleware = refresh de session uniquement).
      // interests IS NULL → onboarding pas encore fait → /onboarding.
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('interests')
          .eq('id', user.id)
          .single()

        if (!profile || profile.interests === null) {
          return NextResponse.redirect(`${origin}/onboarding`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // En cas d'erreur, rediriger vers login
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
