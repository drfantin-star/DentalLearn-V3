'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'

type Status = 'loading' | 'success' | 'error'

export default function VerifyEmailConfirmPage() {
  const router = useRouter()
  const supabase = createClient()
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session?.user?.email_confirmed_at) {
        setStatus('success')
      } else {
        setStatus('error')
      }
    })
    return () => {
      cancelled = true
    }
  }, [supabase])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2D1B96] to-[#1a1060] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {status === 'loading' && (
          <div className="text-center py-8">
            <div className="mx-auto w-10 h-10 border-4 border-[#2D1B96] border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">Vérification en cours...</p>
          </div>
        )}

        {status === 'success' && (
          <>
            <div className="text-center mb-6">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-[#2D1B96] mb-2">Email vérifié</h1>
              <p className="text-gray-600 text-sm">
                Votre adresse a bien été confirmée. Bienvenue sur DentalLearn.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="w-full py-3 bg-[#2D1B96] text-white rounded-lg font-medium hover:bg-[#231470] transition-colors flex items-center justify-center gap-2"
            >
              Accéder à DentalLearn
              <ArrowRight className="w-5 h-5" />
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-center mb-6">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-9 h-9 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-[#2D1B96] mb-2">Lien invalide ou expiré</h1>
              <p className="text-gray-600 text-sm">
                Nous n&apos;avons pas pu confirmer votre email. Le lien est peut-être expiré
                ou a déjà été utilisé.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                href="/login"
                className="block w-full text-center py-3 bg-[#2D1B96] text-white rounded-lg font-medium hover:bg-[#231470] transition-colors"
              >
                Se connecter
              </Link>
              <Link
                href="/forgot-password"
                className="block w-full text-center py-2 text-sm text-[#2D1B96] font-medium hover:underline"
              >
                Demander un nouveau lien
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
