'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Loader2, Briefcase, Building2,
  Shield, Presentation, Camera, Save, Lock, Eye, EyeOff,
  Bell, Mail, Calendar, CheckCircle, AlertCircle, Trash2, X, User,
} from 'lucide-react'
import InterestsSection from '@/components/interests/InterestsSection'
import CreateCabinetModal from '@/components/auth/CreateCabinetModal'
import { PushNotificationToggle } from '@/components/PushNotificationToggle'
import { Modal } from '@/components/ui/Modal'
import Link from 'next/link'
import type { IntraRole } from '@/lib/auth/rbac'

const TENANT_ADMIN_ROLES: ReadonlySet<IntraRole> = new Set<IntraRole>([
  'titulaire',
  'admin_rh',
  'admin_of',
])

export default function ProfilPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
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

  // Mot de passe
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)

  // Notifications
  const [liveSessionReminders, setLiveSessionReminders] = useState(true)
  const [formateurPublications, setFormateurPublications] = useState(true)
  const [savingPrefs, setSavingPrefs] = useState(false)

  // Suppression compte
  const [deletionRequestedAt, setDeletionRequestedAt] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletionLoading, setDeletionLoading] = useState(false)

  // Modal infos perso
  const [showProfilModal, setShowProfilModal] = useState(false)

  // Modal notifications
  const [showNotifModal, setShowNotifModal] = useState(false)

  // Roles / espaces
  const [intraRole, setIntraRole] = useState<IntraRole | null>(null)
  const [orgless, setOrgless] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [isFormateur, setIsFormateur] = useState(false)
  const [showCabinetModal, setShowCabinetModal] = useState(false)

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

      const { data: prefs } = await supabase
        .from('user_notification_preferences')
        .select('live_session_reminders, formateur_publications')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (prefs) {
        if (prefs.live_session_reminders != null) setLiveSessionReminders(prefs.live_session_reminders)
        if (prefs.formateur_publications != null) setFormateurPublications(prefs.formateur_publications)
      }

      try {
        const res = await fetch('/api/user/intra-role')
        if (res.ok) {
          const json = await res.json()
          setIntraRole((json.intra_role as IntraRole | null) ?? null)
          setOrgless(Boolean(json.orgless))
          setIsSuperAdmin(Boolean(json.is_super_admin))
          setIsFormateur(Boolean(json.is_formateur))
        }
      } catch {
        // Fail silencieux : cartes masquees si indisponible
      }

      setLoading(false)
    }
    load()
  }, [])

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        const MAX = 500
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
          else { width = Math.round((width * MAX) / height); height = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('canvas indisponible')); return }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => { blob ? resolve(blob) : reject(new Error('compression echouee')) },
          'image/jpeg',
          0.8
        )
      }
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Format non supporte (JPG ou PNG requis)'))
      }
      img.src = objectUrl
    })
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (!file.type.startsWith('image/')) { showMessage('error', 'Image uniquement (JPG ou PNG)'); return }
    setUploadingPhoto(true)
    try {
      let blob: Blob
      try {
        blob = await compressImage(file)
      } catch {
        showMessage('error', 'Format non supporte — utilise JPG ou PNG')
        setUploadingPhoto(false)
        return
      }
      if (blob.size > 5 * 1024 * 1024) { showMessage('error', 'Image trop lourde meme apres compression'); setUploadingPhoto(false); return }
      const filePath = `${user.id}/${user.id}-${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage
        .from('profile-photos').upload(filePath, blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('profile-photos').getPublicUrl(filePath)
      await supabase.from('user_profiles')
        .update({ profile_photo_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      setPhotoUrl(publicUrl)
      showMessage('success', 'Photo mise a jour !')
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
        ordre_inscription_date: ordreDate || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      if (error) throw error
      showMessage('success', 'Profil mis a jour !')
      setShowProfilModal(false)
    } catch {
      showMessage('error', 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) { showMessage('error', 'Mots de passe differents'); return }
    if (newPassword.length < 8) { showMessage('error', 'Minimum 8 caracteres'); return }
    setPasswordSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      showMessage('success', 'Mot de passe modifie !')
      setShowPasswordForm(false)
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      showMessage('error', err.message || 'Erreur')
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleTogglePref = async (
    key: 'live_session_reminders' | 'formateur_publications',
    value: boolean,
  ) => {
    if (!user) return
    if (key === 'live_session_reminders') setLiveSessionReminders(value)
    else setFormateurPublications(value)
    setSavingPrefs(true)
    try {
      await supabase
        .from('user_notification_preferences')
        .upsert({ user_id: user.id, [key]: value }, { onConflict: 'user_id' })
    } finally {
      setSavingPrefs(false)
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
      showMessage('success', 'Demande de suppression enregistree')
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
      showMessage('success', 'Suppression annulee')
    } catch {
      showMessage('error', "Erreur lors de l'annulation")
    } finally {
      setDeletionLoading(false)
    }
  }

  const handleCabinetCreated = async () => {
    setShowCabinetModal(false)
    await supabase.auth.refreshSession()
    router.refresh()
    try {
      const res = await fetch('/api/user/intra-role')
      if (res.ok) {
        const json = await res.json()
        setIntraRole((json.intra_role as IntraRole | null) ?? null)
        setOrgless(Boolean(json.orgless))
        setIsSuperAdmin(Boolean(json.is_super_admin))
        setIsFormateur(Boolean(json.is_formateur))
      }
    } catch {
      // Fail silencieux
    }
  }

  const getInitials = () => {
    if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase()
    return email[0]?.toUpperCase() || 'U'
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  const showTenantLink = intraRole && TENANT_ADMIN_ROLES.has(intraRole)
  const showUpgradeCard = !loading && orgless && !intraRole
  const showEspacesSection = isSuperAdmin || isFormateur || showTenantLink

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-24">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  )

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0F0F0F' }}>
      <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />

      {/* Header */}
      <header className="bg-gradient-to-br from-primary to-accent px-5 py-4">
        <p className="text-sm font-semibold text-white/80">Mon espace personnel</p>
      </header>

      {/* Message feedback */}
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

        {/* Bandeau suppression planifiee */}
        {deletionRequestedAt && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <Trash2 className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">
                Suppression planifiee le {formatDate(deletionRequestedAt)}
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                Toutes vos donnees seront supprimees definitivement.
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

        {/* Informations personnelles — carte sommaire */}
        <button
          type="button"
          onClick={() => setShowProfilModal(true)}
          className="glass-card transition-premium w-full p-4 text-left hover:border-white/20 rounded-2xl"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
              {photoUrl
                ? <img src={photoUrl} alt="Photo" className="w-full h-full object-cover" />
                : <span className="text-white font-bold text-sm">{getInitials()}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white text-sm truncate">
                {firstName || lastName ? `${firstName} ${lastName}`.trim() : 'Complétez votre profil'}
              </div>
              <div className="text-xs text-white/55 truncate">{email}</div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/40 shrink-0" />
          </div>
        </button>

        {/* Modal — Informations personnelles */}
        <Modal
          open={showProfilModal}
          onClose={() => setShowProfilModal(false)}
          variant="dark"
          size="lg"
          ariaLabel="Informations personnelles"
          className="bg-neutral-900 border border-neutral-800"
        >
          {/* Header modal */}
          <div className="flex items-center justify-between gap-3 px-6 py-5" style={{ borderBottom: '0.5px solid #262626' }}>
            <h2 className="font-bold text-white text-base">Informations personnelles</h2>
            <button
              onClick={() => setShowProfilModal(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-premium"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          {/* Corps modal */}
          <div className="px-6 py-5 max-h-[60vh] overflow-y-auto space-y-4">
            {/* Photo */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  {photoUrl
                    ? <img src={photoUrl} alt="Photo" className="w-full h-full object-cover" />
                    : <span className="text-white font-bold text-lg">{getInitials()}</span>}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute -bottom-1 -right-1 p-1 bg-white rounded-full shadow border"
                >
                  {uploadingPhoto
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    : <Camera className="w-3.5 h-3.5 text-[#6b7280]" />}
                </button>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Photo de profil</p>
                <p className="text-xs text-white/55">JPG, PNG — max 2 MB</p>
              </div>
            </div>

            {/* Prenom + Nom */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-white/55 mb-1">Prenom</label>
                <input
                  type="text" value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  style={{ background: '#1a1a1a', border: '1px solid #333', color: 'white' }}
                  placeholder="Prenom"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/55 mb-1">Nom</label>
                <input
                  type="text" value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  style={{ background: '#1a1a1a', border: '1px solid #333', color: 'white' }}
                  placeholder="Nom"
                />
              </div>
            </div>

            {/* Email lecture seule */}
            <div>
              <label className="block text-xs font-medium text-white/55 mb-1">Email</label>
              <div className="flex items-center gap-2 px-3 py-2" style={{ background: '#1a1a1a', border: '0.5px solid #333', borderRadius: '12px' }}>
                <Mail className="w-4 h-4 text-white/40" />
                <span className="text-sm text-white/55">{email}</span>
              </div>
            </div>

            {/* Date d'inscription a l'Ordre */}
            <div>
              <label className="block text-xs font-medium text-white/55 mb-1">Date d'inscription a l'Ordre</label>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-white/40 shrink-0" />
                <input
                  type="date" value={ordreDate}
                  onChange={e => setOrdreDate(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl text-sm"
                  style={{ background: '#1a1a1a', border: '1px solid #333', color: 'white' }}
                />
              </div>
              <p className="text-xs text-white/55 mt-1.5">
                Determine votre cycle de certification periodique.
              </p>
            </div>
          </div>

          {/* Footer modal */}
          <div className="flex items-center justify-end gap-3 px-6 py-5" style={{ borderTop: '0.5px solid #262626' }}>
            <button
              onClick={() => setShowProfilModal(false)}
              className="px-4 py-2 text-sm text-white/55 hover:text-white rounded-xl transition-premium"
            >
              Annuler
            </button>
            <button
              onClick={handleSaveProfil}
              disabled={saving}
              className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded-xl flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Enregistrer
            </button>
          </div>
        </Modal>

        {/* Centres d'interet */}
        <InterestsSection />

        {/* Notifications — carte sommaire */}
        <button
          type="button"
          onClick={() => setShowNotifModal(true)}
          className="glass-card transition-premium w-full p-4 text-left hover:border-white/20 rounded-2xl"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-white text-sm">Notifications</div>
              <div className="text-xs text-white/55">Rappels et preferences de contenu</div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/40 shrink-0" />
          </div>
        </button>

        {/* Modal — Notifications */}
        <Modal
          open={showNotifModal}
          onClose={() => setShowNotifModal(false)}
          variant="dark"
          size="lg"
          ariaLabel="Notifications"
          className="bg-neutral-900 border border-neutral-800"
        >
          {/* Header modal */}
          <div className="flex items-center justify-between gap-3 px-6 py-5" style={{ borderBottom: '0.5px solid #262626' }}>
            <h2 className="font-bold text-white text-base">Notifications</h2>
            <button
              onClick={() => setShowNotifModal(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-premium"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          {/* Corps modal */}
          <div className="px-6 py-5 max-h-[60vh] overflow-y-auto space-y-5">
            <PushNotificationToggle />

            <div className="space-y-3 pt-4" style={{ borderTop: '0.5px solid #333' }}>
              <p className="text-xs font-medium text-white/55">Preferences de contenu</p>
              <button
                onClick={() => { void handleTogglePref('live_session_reminders', !liveSessionReminders) }}
                disabled={savingPrefs}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all font-medium w-full text-left ${
                  liveSessionReminders
                    ? 'bg-accent/10 text-accent border border-accent/20'
                    : 'bg-white/5 text-white/70 hover:bg-white/10'
                } ${savingPrefs ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Bell className="w-5 h-5 shrink-0" />
                <span className="text-sm">Rappels sessions live</span>
              </button>
              <button
                onClick={() => { void handleTogglePref('formateur_publications', !formateurPublications) }}
                disabled={savingPrefs}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all font-medium w-full text-left ${
                  formateurPublications
                    ? 'bg-accent/10 text-accent border border-accent/20'
                    : 'bg-white/5 text-white/70 hover:bg-white/10'
                } ${savingPrefs ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Bell className="w-5 h-5 shrink-0" />
                <span className="text-sm">Nouvelles publications formateurs</span>
              </button>
            </div>
          </div>

          {/* Footer modal */}
          <div className="flex items-center justify-end gap-3 px-6 py-5" style={{ borderTop: '0.5px solid #262626' }}>
            <button
              onClick={() => setShowNotifModal(false)}
              className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded-xl"
            >
              Fermer
            </button>
          </div>
        </Modal>

        {/* Carte upgrade solo -> cabinet (uniquement si orgless) */}
        {showUpgradeCard && (
          <button
            type="button"
            onClick={() => setShowCabinetModal(true)}
            className="glass-card transition-premium w-full p-4 text-left hover:border-white/20 rounded-2xl"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-[#8B5CF6]" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white text-sm">Creer mon cabinet</div>
                <div className="text-xs text-white/55">Devenez titulaire et invitez vos collaborateurs.</div>
              </div>
              <ChevronRight className="w-5 h-5 text-white/40" />
            </div>
          </button>
        )}

        {/* Mes espaces — visible si super_admin et/ou formateur */}
        {showEspacesSection && (
          <section>
            <h2 className="text-base font-bold text-white mb-1">Mes espaces</h2>
            <p className="text-xs text-white/55 mb-3">Accedez a vos espaces dedies selon vos roles.</p>
            <div className="space-y-3">
              {isSuperAdmin && (
                <Link href="/admin" className="glass-card transition-premium block p-4 hover:border-amber-500/40 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-white text-sm">Administration</div>
                      <div className="text-xs text-white/55">Gestion de la plateforme, formateurs, organisations.</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/40" />
                  </div>
                </Link>
              )}
              {isFormateur && (
                <Link href="/formateur/dashboard" className="glass-card transition-premium block p-4 hover:border-white/20 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                      <Presentation className="w-5 h-5 text-[#8B5CF6]" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-white text-sm">Espace Formateur</div>
                      <div className="text-xs text-white/55">Suivez vos formations animees, masterclass et profil public.</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/40" />
                  </div>
                </Link>
              )}
              {showTenantLink && (
                <Link href="/tenant/admin" className="glass-card transition-premium block p-4 hover:border-white/20 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                      <Briefcase className="w-5 h-5 text-[#8B5CF6]" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-white text-sm">Mon cabinet</div>
                      <div className="text-xs text-white/55">Gerez votre cabinet, vos collaborateurs et leurs acces.</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/40" />
                  </div>
                </Link>
              )}
            </div>
          </section>
        )}

        {/* Securite */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gray-100 rounded-xl">
              <Lock className="w-4 h-4 text-[#6b7280]" />
            </div>
            <h3 className="font-semibold text-white">Securite</h3>
          </div>

          {showPasswordForm ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-white/55 mb-1">Nouveau mot de passe</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm pr-10"
                    style={{ background: '#1a1a1a', border: '1px solid #333', color: 'white' }}
                    placeholder="Minimum 8 caracteres"
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40">
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/55 mb-1">Confirmer</label>
                <input type="password" value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: '#1a1a1a', border: '1px solid #333', color: 'white' }} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleChangePassword} disabled={passwordSaving || !newPassword || !confirmPassword}
                  className="flex-1 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                  {passwordSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Changer
                </button>
                <button onClick={() => { setShowPasswordForm(false); setNewPassword(''); setConfirmPassword('') }}
                  className="px-4 py-2.5 text-sm text-white/55 hover:bg-gray-100 hover:text-gray-900 rounded-xl transition-premium">
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowPasswordForm(true)}
              className="flex items-center justify-between w-full py-2 text-left hover:bg-gray-50 hover:text-gray-900 rounded-xl px-2 -mx-2 transition-premium">
              <span className="text-sm text-white/70">Changer mon mot de passe</span>
              <ChevronLeft className="w-4 h-4 text-white/40 rotate-180" />
            </button>
          )}
        </div>

        {/* Zone dangereuse */}
        <div className="glass-card rounded-2xl p-5" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
          <h3 className="font-semibold text-red-500 mb-1">Zone dangereuse</h3>
          <p className="text-xs text-white/55 mb-4">
            La suppression est irreversible apres 30 jours. Toutes vos donnees seront effacees.
          </p>

          {!deletionRequestedAt && !showDeleteConfirm && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 text-sm text-red-500 font-medium hover:text-red-400 transition-premium"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer mon compte
            </button>
          )}

          {showDeleteConfirm && !deletionRequestedAt && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-red-400">
                Etes-vous sur ? Cette action planifie la suppression dans 30 jours.
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
                  className="px-4 py-2.5 text-sm text-white/55 hover:bg-gray-100 hover:text-gray-900 rounded-xl transition-premium"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {showCabinetModal && (
        <CreateCabinetModal
          onClose={() => setShowCabinetModal(false)}
          onCreated={handleCabinetCreated}
        />
      )}
    </div>
  )
}
