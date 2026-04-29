'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, CheckCircle2, Loader2, Send, ArrowLeft } from 'lucide-react'

const CATEGORIES = [
  { value: 'contenu_pedagogique', label: 'Contenu pédagogique' },
  { value: 'facturation', label: 'Facturation' },
  { value: 'technique', label: 'Problème technique' },
  { value: 'accessibilite', label: 'Accessibilité' },
  { value: 'autre', label: 'Autre' },
] as const

type CategorieValue = typeof CATEGORIES[number]['value']

export default function ReclamationPage() {
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [sujet, setSujet] = useState('')
  const [categorie, setCategorie] = useState<CategorieValue>('autre')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation côté client
    if (!email.trim() || !sujet.trim() || !message.trim()) {
      setError('Merci de remplir tous les champs obligatoires.')
      return
    }
    if (!email.includes('@')) {
      setError("L'adresse email n'est pas valide.")
      return
    }
    if (message.trim().length < 20) {
      setError('Votre message doit comporter au moins 20 caractères.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const { error: insertErr } = await supabase
        .from('complaints')
        .insert({
          user_id: user?.id || null,
          email_contact: email.trim(),
          nom_contact: nom.trim() || null,
          sujet: sujet.trim(),
          categorie,
          message: message.trim(),
        })

      if (insertErr) throw insertErr

      setSuccess(true)
      // Reset form
      setNom('')
      setEmail('')
      setSujet('')
      setCategorie('autre')
      setMessage('')
    } catch (err: any) {
      console.error('Erreur soumission réclamation :', err)
      setError(err.message || 'Erreur lors de l\'envoi. Merci de réessayer.')
    } finally {
      setLoading(false)
    }
  }

  // État succès
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-lg border border-green-100 overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-6 py-5 flex items-center gap-3">
            <CheckCircle2 className="w-7 h-7 text-white flex-shrink-0" />
            <div>
              <p className="text-white font-bold text-lg">Réclamation transmise</p>
              <p className="text-green-50 text-xs">Nous avons bien reçu votre message</p>
            </div>
          </div>
          <div className="p-6 space-y-3 text-sm text-gray-700">
            <p>
              Votre réclamation a été enregistrée. Nous nous engageons à vous répondre
              sous <strong>15 jours ouvrés</strong> à l'adresse email indiquée.
            </p>
            <p className="text-xs text-gray-500">
              Pour toute question urgente, vous pouvez également nous contacter directement
              à <a href="mailto:contact@dentalschool.fr" className="text-[#0F7B6C] underline">
                contact@dentalschool.fr
              </a>
            </p>
            <div className="pt-4 flex flex-col gap-2">
              <button
                onClick={() => setSuccess(false)}
                className="w-full py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Soumettre une autre réclamation
              </button>
              <Link
                href="/"
                className="w-full py-2.5 bg-[#0F7B6C] text-white text-sm font-semibold rounded-xl hover:bg-[#0a5f54] transition-colors text-center"
              >
                Retour à l'accueil
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // État formulaire
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-8 px-4">
      <div className="w-full max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Formulaire de réclamation</h1>
          <p className="text-sm text-gray-500 mt-1">
            Dentalschool — EROJU SAS · Qualiopi QUA006589
          </p>
        </div>

        {/* Info légale */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 text-xs text-blue-900">
          <p className="font-semibold mb-1">Vos droits</p>
          <p>
            Toute réclamation est traitée dans un délai de 15 jours ouvrés.
            Conformément au RGPD, vous pouvez demander l'accès, la rectification ou
            la suppression de vos données à{' '}
            <a href="mailto:contact@dentalschool.fr" className="underline">
              contact@dentalschool.fr
            </a>.
          </p>
        </div>

        {/* Formulaire */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-4"
        >
          {/* Nom */}
          <div>
            <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-1">
              Nom <span className="text-gray-400 text-xs">(optionnel)</span>
            </label>
            <input
              id="nom"
              type="text"
              value={nom}
              onChange={e => setNom(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#0F7B6C] focus:ring-1 focus:ring-[#0F7B6C]"
              placeholder="Dr Jean Dupont"
              maxLength={255}
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#0F7B6C] focus:ring-1 focus:ring-[#0F7B6C]"
              placeholder="votre@email.fr"
              maxLength={255}
            />
            <p className="text-xs text-gray-400 mt-1">Nous vous répondrons à cette adresse.</p>
          </div>

          {/* Catégorie */}
          <div>
            <label htmlFor="categorie" className="block text-sm font-medium text-gray-700 mb-1">
              Catégorie <span className="text-red-500">*</span>
            </label>
            <select
              id="categorie"
              value={categorie}
              onChange={e => setCategorie(e.target.value as CategorieValue)}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#0F7B6C] focus:ring-1 focus:ring-[#0F7B6C]"
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Sujet */}
          <div>
            <label htmlFor="sujet" className="block text-sm font-medium text-gray-700 mb-1">
              Sujet <span className="text-red-500">*</span>
            </label>
            <input
              id="sujet"
              type="text"
              value={sujet}
              onChange={e => setSujet(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#0F7B6C] focus:ring-1 focus:ring-[#0F7B6C]"
              placeholder="Résumé en une ligne"
              maxLength={255}
            />
          </div>

          {/* Message */}
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="message"
              value={message}
              onChange={e => setMessage(e.target.value)}
              required
              rows={6}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#0F7B6C] focus:ring-1 focus:ring-[#0F7B6C] resize-none"
              placeholder="Décrivez votre réclamation en détail (minimum 20 caractères)..."
              maxLength={5000}
            />
            <p className="text-xs text-gray-400 mt-1">{message.length} / 5000 caractères</p>
          </div>

          {/* Erreur */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Bouton */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#0F7B6C] text-white text-sm font-semibold rounded-2xl hover:bg-[#0a5f54] transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Envoi...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Envoyer ma réclamation</span>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-400 space-y-1">
          <p>EROJU SAS — 76 Bd Meusnier de Querlon, 44000 Nantes</p>
          <p>SIRET 95271921900018 — Qualiopi QUA006589</p>
        </div>
      </div>
    </div>
  )
}
