'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft,
  Loader2,
  Mail,
  Calendar,
  User,
  Tag,
  Save,
  CheckCircle2,
} from 'lucide-react'

type ComplaintStatus = 'nouvelle' | 'en_cours' | 'resolue' | 'close'

interface Complaint {
  id: string
  user_id: string | null
  email_contact: string
  nom_contact: string | null
  sujet: string
  categorie: string
  message: string
  status: ComplaintStatus
  admin_response: string | null
  admin_note: string | null
  resolved_at: string | null
  created_at: string
}

const STATUS_OPTIONS: { value: ComplaintStatus; label: string }[] = [
  { value: 'nouvelle', label: 'Nouvelle' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'resolue', label: 'Résolue' },
  { value: 'close', label: 'Close' },
]

const CATEGORIE_LABELS: Record<string, string> = {
  contenu_pedagogique: 'Contenu pédagogique',
  facturation: 'Facturation',
  technique: 'Technique',
  accessibilite: 'Accessibilité',
  autre: 'Autre',
}

export default function ComplaintDetailPage() {
  const params = useParams<{ id: string }>()
  const [complaint, setComplaint] = useState<Complaint | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Champs éditables
  const [status, setStatus] = useState<ComplaintStatus>('nouvelle')
  const [adminResponse, setAdminResponse] = useState('')
  const [adminNote, setAdminNote] = useState('')

  useEffect(() => {
    if (params.id) loadComplaint(params.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const loadComplaint = async (id: string) => {
    try {
      const supabase = createClient()
      const { data, error: fetchErr } = await supabase
        .from('complaints')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchErr) throw fetchErr
      if (!data) throw new Error('Réclamation introuvable')

      setComplaint(data as Complaint)
      setStatus(data.status as ComplaintStatus)
      setAdminResponse(data.admin_response || '')
      setAdminNote(data.admin_note || '')
    } catch (err: any) {
      console.error('Erreur load complaint:', err)
      setError(err.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!complaint) return
    setSaving(true)
    setSaved(false)

    try {
      const supabase = createClient()
      const updates: Record<string, any> = {
        status,
        admin_response: adminResponse.trim() || null,
        admin_note: adminNote.trim() || null,
      }

      // Si on passe à résolue/close pour la 1ère fois, fixer resolved_at
      if (
        (status === 'resolue' || status === 'close') &&
        !complaint.resolved_at
      ) {
        updates.resolved_at = new Date().toISOString()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) updates.resolved_by = user.id
      }

      const { error: updateErr } = await supabase
        .from('complaints')
        .update(updates)
        .eq('id', complaint.id)

      if (updateErr) throw updateErr

      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      // Recharger pour récupérer les valeurs à jour
      await loadComplaint(complaint.id)
    } catch (err: any) {
      console.error('Erreur update:', err)
      setError(err.message || 'Erreur de sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-[#2D1B96]" />
      </div>
    )
  }

  if (error || !complaint) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error || 'Réclamation introuvable'}
        </div>
        <Link
          href="/admin/reclamations"
          className="inline-flex items-center gap-1 mt-4 text-sm text-[#2D1B96] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à la liste
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/reclamations"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à la liste
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{complaint.sujet}</h1>
      </div>

      {/* Métadonnées */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <MetaRow icon={<User className="w-4 h-4" />} label="Plaignant">
            {complaint.nom_contact || 'Anonyme'}
            {complaint.user_id && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                Connecté
              </span>
            )}
          </MetaRow>
          <MetaRow icon={<Mail className="w-4 h-4" />} label="Email">
            <a
              href={`mailto:${complaint.email_contact}`}
              className="text-[#2D1B96] hover:underline"
            >
              {complaint.email_contact}
            </a>
          </MetaRow>
          <MetaRow icon={<Tag className="w-4 h-4" />} label="Catégorie">
            {CATEGORIE_LABELS[complaint.categorie] || complaint.categorie}
          </MetaRow>
          <MetaRow icon={<Calendar className="w-4 h-4" />} label="Reçue le">
            {formatDate(complaint.created_at)}
          </MetaRow>
          {complaint.resolved_at && (
            <MetaRow icon={<CheckCircle2 className="w-4 h-4" />} label="Résolue le">
              {formatDate(complaint.resolved_at)}
            </MetaRow>
          )}
        </div>
      </div>

      {/* Message du plaignant */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">
          Message du plaignant
        </h2>
        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
          {complaint.message}
        </p>
      </div>

      {/* Traitement admin */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">
          Traitement de la réclamation
        </h2>

        {/* Statut */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Statut
          </label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as ComplaintStatus)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white text-gray-900 focus:outline-none focus:border-[#2D1B96] focus:ring-1 focus:ring-[#2D1B96]"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Réponse */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Réponse au plaignant
            <span className="ml-1 text-gray-400">(à copier-coller dans votre email)</span>
          </label>
          <textarea
            rows={6}
            value={adminResponse}
            onChange={e => setAdminResponse(e.target.value)}
            placeholder="Bonjour,&#10;&#10;Suite à votre réclamation..."
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#2D1B96] focus:ring-1 focus:ring-[#2D1B96] resize-none"
          />
        </div>

        {/* Note interne */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Note interne <span className="text-gray-400">(non visible par le plaignant)</span>
          </label>
          <textarea
            rows={3}
            value={adminNote}
            onChange={e => setAdminNote(e.target.value)}
            placeholder="Notes pour suivi interne..."
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#2D1B96] focus:ring-1 focus:ring-[#2D1B96] resize-none"
          />
        </div>

        {/* Bouton sauvegarder */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 ${
            saved
              ? 'bg-green-500 text-white'
              : 'bg-[#2D1B96] text-white hover:bg-[#231575]'
          }`}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Sauvegarde...</span>
            </>
          ) : saved ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Sauvegardé</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Enregistrer les modifications</span>
            </>
          )}
        </button>

        {/* Bouton mailto rapide */}
        <a
          href={`mailto:${complaint.email_contact}?subject=${encodeURIComponent('Re: ' + complaint.sujet)}&body=${encodeURIComponent(adminResponse || '')}`}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <Mail className="w-4 h-4" />
          Ouvrir dans mon client mail
        </a>
      </div>
    </div>
  )
}

function MetaRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500">{label}</p>
        <div className="text-sm text-gray-900 font-medium break-words">{children}</div>
      </div>
    </div>
  )
}
