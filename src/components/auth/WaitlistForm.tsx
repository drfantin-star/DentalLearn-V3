'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mail, CheckCircle2, Send } from 'lucide-react'
import Link from 'next/link'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const normalizedEmail = email.trim().toLowerCase()
    if (!EMAIL_RE.test(normalizedEmail)) {
      setError('Veuillez saisir une adresse email valide.')
      return
    }
    if (!consent) {
      setError('Vous devez accepter d\'être recontacté pour rejoindre la liste.')
      return
    }

    setLoading(true)
    try {
      const { error: insertError } = await supabase
        .from('waitlist')
        .insert({ email: normalizedEmail, consent: true })

      if (insertError) {
        // Violation de contrainte d unicité (email déjà présent) : on traite
        // ça comme un succès du point de vue de l utilisateur — il est déjà
        // sur la liste, inutile de l inquiéter avec une erreur technique.
        if (
          insertError.code === '23505' ||
          insertError.message.toLowerCase().includes('duplicate')
        ) {
          setSubmitted(true)
          return
        }
        throw insertError
      }

      setSubmitted(true)
    } catch (err: unknown) {
      console.error('Erreur inscription waitlist:', err)
      setError(
        'Une erreur est survenue. Veuillez réessayer dans quelques instants.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-[#1a1060] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Certily</h1>
          <p className="text-gray-600">
            Certily ouvre bientôt. Rejoignez la liste d&apos;attente de la bêta.
          </p>
        </div>

        {submitted ? (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle2 className="w-14 h-14 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">
              Vous êtes sur la liste !
            </h2>
            <p className="text-sm text-gray-600">
              Merci. Nous vous recontacterons dès que la bêta Certily sera
              disponible.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            {error && (
              <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="votre@email.com"
                />
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                required
                className="mt-1 w-4 h-4 text-primary focus:ring-primary rounded"
              />
              <span className="text-sm text-gray-700">
                J&apos;accepte d&apos;être recontacté au sujet de la bêta Certily
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !consent}
              className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-[#231470] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Enregistrement...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Rejoindre la liste d&apos;attente
                </>
              )}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Déjà un compte ?{' '}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
