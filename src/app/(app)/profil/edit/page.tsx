'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, Camera, Save, Lock, Eye, EyeOff,
  Bell, Mail, Calendar, Loader2, CheckCircle,
  AlertCircle, Trash2
} from 'lucide-react'
import { PushNotificationToggle } from '@/components/PushNotificationToggle'

export default function EditProfilPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Infos perso
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [saving, setSaving] = useState(false)

  // Ordre
  const [ordreDate, setOrdreDate] = useState<string>('')
  const [savingOrdre, setSavingOrdre] = useState(false)

  // Mot de passe
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)

  // Suppression compte
  const [deletionRequestedAt, setDeletionRequestedAt] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletionLoading, setDeletionLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      setEmail(session.user.email || '')

      const { data } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, profile_photo_url, ordre_inscription_date, deletion_requested_at')
        .eq('id', session.user.id)
        .single()

      if (data) {
        setFirstName(data.first_name || '')
        setLastName(data.last_name || '')
        setPhotoUrl(data.profile_photo_url)
        setOrdreDate(data.ordre_inscription_date || '')
        setDeletionRequestedAt(data.deletion_requested_at)
      }
      setLoading(false)
    }
    load()
  }, [])

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (!file.type.startsWith('image/')) { showMessage('error', 'Image uniquement'); return }
    if (file.size > 2 * 1024 * 1024) { showMessage('error', 'Max 2 MB'); return }

    setUploadingPhoto(true)
    try {
      const fileExt = file.name.split('.').pop()
      const filePath = `${user.id}/${user.id}-${Date.now()}.${fileExt}`
      const { error: upErr } = await supabase.storage
        .from('profile-photos').upload(filePath, file, { cacheControl: '3600', upsert: false })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('profile-photos').getPublicUrl(filePath)
      await supabase.from('user_profiles')
        .update({ profile_photo_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      setPhotoUrl(publicUrl)
      showMessage('success', 'Photo mise à jour !')
    } catch (err: any) {
      showMessage('error', err.message || 'Erreur upload')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleSaveProfil = async () => {
    if (!user) return
    setSaving(true)
    try {
      const { error } = await supabase.from('user_profiles').upsert({
        id: user.id,
        first_name: firstName || null,
        last_name: lastName || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      if (error) throw error
      showMessage('success', 'Profil mis à jour !')
    } catch {
      showMessage('error', 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveOrdre = async () => {
    if (!user) return
    setSavingOrdre(true)
    try {
      const { error } = await supabase.from('user_profiles')
        .update({ ordre_inscription_date: ordreDate || null, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (error) throw error
      showMessage('success', 'Date mise à jour !')
    } catch {
      showMessage('error', 'Erreur lors de la mise à jour')
    } finally {
      setSavingOrdre(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) { showMessage('error', 'Mots de passe différents'); return }
    if (newPassword.length < 8) { showMessage('error', 'Minimum 8 caractères'); return }
    setPasswordSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      showMessage('success', 'Mot de passe modifié !')
      setShowPasswordForm(false)
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      showMessage('error', err.message || 'Erreur')
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleRequestDeletion = async () => {
    setDeletionLoading(true)
    try {
      const res = await fetch('/api/user/delete', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDeletionRequestedAt(data.deletion_date)
      setShowDeleteConfirm(false)
      showMessage('success', 'Demande de suppression enregistrée')
    } catch (err: any) {
      showMessage('error', err.message || 'Erreur')
    } finally {
      setDeletionLoading(false)
    }
  }

  const handleCancelDeletion = async () => {
    setDeletionLoading(true)
    try {
      const res = await fetch('/api/user/delete', { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setDeletionRequestedAt(null)
      showMessage('success', 'Suppression annulée')
    } catch {
      showMessage('error', 'Erreur lors de l\'annulation')
    } finally {
      setDeletionLoading(false)
    }
  }

  const getInitials = () => {
    if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase()
    return email[0]?.toUpperCase() || 'U'
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-24">
      <Loader2 className="animate-spin text-[#2D1B96]" size={32} />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-gray-100 rounded-xl transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Éditer mon profil</h1>
        </div>
      </header>

      {/* Message */}
      {message && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className={`p-3 rounded-xl flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.type === 'success'
              ? <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />}
            <p className="text-sm">{message.text}</p>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Bandeau suppression planifiée */}
        {deletionRequestedAt && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <Trash2 className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">
                Suppression planifiée le {formatDate(deletionRequestedAt)}
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                Toutes vos données seront supprimées définitivement.
              </p>
              <button
                onClick={handleCancelDeletion}
                disabled={deletionLoading}
                className="mt-2 text-xs font-semibold text-red-700 underline"
              >
                {deletionLoading ? 'Annulation...' : 'Annuler la suppression'}
              </button>
            </div>
          </div>
        )}

        {/* Photo + Nom + Prénom */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Informations personnelles</h3>

          {/* Photo */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-[#2D1B96] to-[#00D1C1] flex items-center justify-center">
                {photoUrl ? (
                  <img src={photoUrl} alt="Photo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-lg">{getInitials()}</span>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-1 -right-1 p-1 bg-white rounded-full shadow border"
              >
                {uploadingPhoto
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2D1B96]" />
                  : <Camera className="w-3.5 h-3.5 text-gray-600" />}
              </button>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Photo de profil</p>
              <p className="text-xs text-gray-400">JPG, PNG — max 2 MB</p>
            </div>
          </div>

          {/* Prénom + Nom */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Prénom</label>
              <input
                type="text" value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                placeholder="Prénom"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nom</label>
              <input
                type="text" value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                placeholder="Nom"
              />
            </div>
          </div>

          {/* Email lecture seule */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
              <Mail className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">{email}</span>
            </div>
          </div>

          <button
            onClick={handleSaveProfil}
            disabled={saving}
            className="w-full py-2.5 bg-[#2D1B96] text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </button>
        </div>

        {/* Inscription à l'Ordre */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <h3 className="font-semibold text-gray-900">Inscription à l'Ordre</h3>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date d'inscription</label>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="date" value={ordreDate}
                onChange={e => setOrdreDate(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Détermine votre période de certification périodique.
            </p>
          </div>
          <button
            onClick={handleSaveOrdre}
            disabled={savingOrdre}
            className="w-full py-2.5 bg-[#2D1B96] text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {savingOrdre ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </button>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 rounded-xl">
              <Bell className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              <p className="text-xs text-gray-400">Rappels et résultats</p>
            </div>
          </div>
          <PushNotificationToggle />
        </div>

        {/* Mot de passe */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gray-100 rounded-xl">
              <Lock className="w-4 h-4 text-gray-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Sécurité</h3>
          </div>

          {showPasswordForm ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nouveau mot de passe</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm pr-10"
                    placeholder="Minimum 8 caractères"
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Confirmer</label>
                <input type="password" value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleChangePassword} disabled={passwordSaving || !newPassword || !confirmPassword}
                  className="flex-1 py-2.5 bg-[#2D1B96] text-white text-sm font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                  {passwordSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Changer
                </button>
                <button onClick={() => { setShowPasswordForm(false); setNewPassword(''); setConfirmPassword('') }}
                  className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowPasswordForm(true)}
              className="flex items-center justify-between w-full py-2 text-left hover:bg-gray-50 rounded-xl px-2 -mx-2">
              <span className="text-sm text-gray-700">Changer mon mot de passe</span>
              <ChevronLeft className="w-4 h-4 text-gray-400 rotate-180" />
            </button>
          )}
        </div>

        {/* Zone danger — Suppression compte */}
        <div className="bg-white rounded-2xl border border-red-100 p-5">
          <h3 className="font-semibold text-red-700 mb-1">Zone dangereuse</h3>
          <p className="text-xs text-gray-400 mb-4">
            La suppression est irréversible après 30 jours. Toutes vos données seront effacées.
          </p>

          {!deletionRequestedAt && !showDeleteConfirm && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 text-sm text-red-500 font-medium hover:text-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer mon compte
            </button>
          )}

          {showDeleteConfirm && !deletionRequestedAt && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-red-800">
                Êtes-vous sûr ? Cette action planifie la suppression dans 30 jours.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleRequestDeletion}
                  disabled={deletionLoading}
                  className="flex-1 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {deletionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Confirmer la suppression
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
