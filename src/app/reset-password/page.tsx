'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'

function ResetPasswordContent() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [sessionReady, setSessionReady] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    let isMounted = true
    let timeoutId: NodeJS.Timeout

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return
        if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session) || (event === 'TOKEN_REFRESHED' && session)) {
          setSessionReady(true)
          setVerifying(false)
          setError('')
        }
      }
    )

    const exchangeToken = async () => {
      const token = searchParams.get('token')
      const type = searchParams.get('type')

      if (token && type === 'recovery') {
        try {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(token)
          if (exchangeError) {
            if (isMounted) { setError('Lien invalide ou expiré.'); setVerifying(false) }
            return
          }
          if (data.session && isMounted) { setSessionReady(true); setVerifying(false); setError('') }
        } catch (err) {
          if (isMounted) { setError('Lien invalide ou expiré.'); setVerifying(false) }
        }
      } else {
        const { data: { session } } = await supabase.auth.getSession()
        if (session && isMounted) { setSessionReady(true); setVerifying(false); setError('') }
      }
    }

    exchangeToken()

    timeoutId = setTimeout(() => {
      if (isMounted && verifying) {
        setVerifying(false)
        if (!sessionReady) setError('Lien invalide ou expiré.')
      }
    }, 10000)

    return () => { isMounted = false; subscription.unsubscribe(); clearTimeout(timeoutId) }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionReady) { setError('Session invalide.'); return }
    if (password !== confirmPassword) { setError('Les mots de passe ne correspondent pas'); return }
    if (password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères'); return }

    setLoading(true)
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Session expirée.')

      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      setSuccess(true)
      await supabase.auth.signOut()
      setTimeout(() => router.push('/login'), 2000)
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  if (verifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2D1B96] to-[#1a1060] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D1B96] mx-auto mb-4"></div>
          <p className="text-gray-600">Vérification du lien...</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2D1B96] to-[#1a1060] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Mot de passe modifié !</h1>
          <p className="text-gray-600 mb-6">Vous allez être redirigé vers la page de connexion.</p>
          <div className="animate-pulse"><p className="text-sm text-gray-500">Redirection...</p></div>
        </div>
      </div>
    )
  }

  if (error && !sessionReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2D1B96] to-[#1a1060] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Lien invalide</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link href="/forgot-password" className="inline-block px-6 py-3 bg-[#2D1B96] text-white rounded-xl hover:bg-[#231470] transition-colors">
            Demander un nouveau lien
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2D1B96] to-[#1a1060] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#2D1B96] mb-2">DentalLearn</h1>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Nouveau mot de passe</h2>
          <p className="text-gray-600">Choisissez un mot de passe sécurisé</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-800">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nouveau mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                placeholder="Minimum 8 caractères"
                required
                minLength={8}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {password && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  <div className={`h-1 flex-1 rounded ${password.length >= 8 ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                  <div className={`h-1 flex-1 rounded ${password.length >= 10 ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                  <div className={`h-1 flex-1 rounded ${password.length >= 12 && /[!@#$%^&*]/.test(password) ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Confirmer le mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent ${
                  confirmPassword && password !== confirmPassword ? 'border-red-300 bg-red-50' :
                  confirmPassword && password === confirmPassword ? 'border-green-300 bg-green-50' : 'border-gray-300'
                }`}
                placeholder="Répétez le mot de passe"
                required
              />
              {confirmPassword && password === confirmPassword && (
                <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !password || !confirmPassword || password !== confirmPassword}
            className="w-full py-3 bg-[#2D1B96] text-white font-bold rounded-xl hover:bg-[#231470] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Modification...
              </>
            ) : (
              'Modifier mon mot de passe'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-gray-600 hover:text-[#2D1B96] transition-colors">
            Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#2D1B96] to-[#1a1060] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D1B96] mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
