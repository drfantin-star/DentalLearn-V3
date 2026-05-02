'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mail, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

const RESEND_COOLDOWN_SECONDS = 60

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const email = searchParams.get('email') ?? ''

  const [cooldown, setCooldown] = useState(0)
  const [resending, setResending] = useState(false)
  const [resendError, setResendError] = useState('')
  const [resendSuccess, setResendSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session?.user?.email_confirmed_at) {
        router.replace('/')
      }
    })
    return () => {
      cancelled = true
    }
  }, [router, supabase])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  async function handleResend() {
    if (!email || cooldown > 0 || resending) return
    setResending(true)
    setResendError('')
    setResendSuccess(false)
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email })
      if (error) throw error
      setResendSuccess(true)
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (err: any) {
      console.error('Erreur renvoi email:', err)
      setResendError(err?.message || 'Impossible de renvoyer l’email pour le moment')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2D1B96] to-[#1a1060] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-[#2D1B96]/10 flex items-center justify-center">
            <Mail className="w-8 h-8 text-[#2D1B96]" />
          </div>
          <h1 className="text-2xl font-bold text-[#2D1B96] mb-2">Vérifiez votre boîte mail</h1>
          <p className="text-gray-600 text-sm">
            Nous avons envoyé un lien de confirmation à&nbsp;:
          </p>
          {email ? (
            <p className="mt-2 font-medium text-gray-900 break-all">{email}</p>
          ) : (
            <p className="mt-2 text-sm text-gray-500 italic">adresse non renseignée</p>
          )}
        </div>

        <div className="space-y-4 text-sm text-gray-600">
          <p>
            Cliquez sur le lien reçu pour activer votre compte. Pensez à vérifier vos
            spams si vous ne le voyez pas.
          </p>

          {resendSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-green-700">Email renvoyé. Pensez à vérifier vos spams.</p>
            </div>
          )}

          {resendError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700">{resendError}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleResend}
            disabled={!email || cooldown > 0 || resending}
            className="w-full py-3 bg-[#2D1B96] text-white rounded-lg font-medium hover:bg-[#231470] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {resending ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Envoi en cours...
              </>
            ) : cooldown > 0 ? (
              <>
                <RefreshCw className="w-5 h-5" />
                Renvoyer dans {cooldown}s
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Renvoyer l&apos;email
              </>
            )}
          </button>
        </div>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-[#2D1B96] font-medium hover:underline">
            Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-[#2D1B96] to-[#1a1060] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D1B96] mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement...</p>
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  )
}
