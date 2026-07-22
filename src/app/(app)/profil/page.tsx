'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, ChevronDown, Loader2, Briefcase, Building2,
  Shield, Presentation, BadgeCheck, Camera, Save, Lock, Eye, EyeOff,
  Bell, BellOff, Send, Mail, Calendar, CheckCircle, AlertCircle, Trash2, X, User, LogOut,
} from 'lucide-react'
import InterestsSection from '@/components/interests/InterestsSection'
import CreateCabinetModal from '@/components/auth/CreateCabinetModal'
import { useNotificationOrchestrator } from '@/context/NotificationOrchestratorContext'
import { Modal } from '@/components/ui/Modal'
import Link from 'next/link'
import type { IntraRole } from '@/lib/auth/rbac'
import { useSignOut } from '@/lib/hooks/useSignOut'

const TENANT_ADMIN_ROLES: ReadonlySet<IntraRole> = new Set<IntraRole>([
  'titulaire',
  'admin_rh',
  'admin_of',
])

// Les 9 sous-préférences (après suppression de new_sequences), groupées en
// 3 familles pour la modale « Personnaliser ».
type PrefKey =
  | 'daily_reminders'
  | 'cp_reminders'
  | 'autopilot_reminders'
  | 'leaderboard_results'
  | 'new_formations'
  | 'weekly_journal'
  | 'formateur_publications'
  | 'new_tools'
  | 'live_session_reminders'

interface NotifFamily {
  id: string
  label: string
  keys: { key: PrefKey; label: string; hint?: string }[]
}

const NOTIF_FAMILIES: NotifFamily[] = [
  {
    id: 'parcours',
    label: 'Ton parcours',
    keys: [
      { key: 'daily_reminders', label: 'Rappel quotidien' },
      { key: 'cp_reminders', label: 'Rappel certification' },
      { key: 'autopilot_reminders', label: 'Plan mensuel Sophie' },
      { key: 'leaderboard_results', label: 'Résultats du classement' },
    ],
  },
  {
    id: 'nouveautes',
    label: 'Nouveautés',
    keys: [
      { key: 'new_formations', label: 'Nouvelles formations' },
      { key: 'weekly_journal', label: 'Journal hebdomadaire' },
      { key: 'formateur_publications', label: 'Publications des formateurs' },
      {
        key: 'new_tools',
        label: 'Nouveaux outils',
        hint: 'Être prévenu quand un nouvel outil arrive dans la boîte à outils.',
      },
    ],
  },
  {
    id: 'direct',
    label: 'En direct',
    keys: [{ key: 'live_session_reminders', label: 'Sessions en direct' }],
  },
]

export default function ProfilPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const handleSignOut = useSignOut()

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
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [dailyReminders, setDailyReminders] = useState(true)
  const [liveSessionReminders, setLiveSessionReminders] = useState(true)
  const [formateurPublications, setFormateurPublications] = useState(true)
  const [weeklyJournal, setWeeklyJournal] = useState(true)
  const [newFormations, setNewFormations] = useState(true)
  const [cpReminders, setCpReminders] = useState(true)
  const [autopilotReminders, setAutopilotReminders] = useState(true)
  const [newTools, setNewTools] = useState(true)
  const [leaderboardResults, setLeaderboardResults] = useState(true)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [showCustomize, setShowCustomize] = useState(false)
  // Interrupteur push partagé via le provider unique (une seule registration SW,
  // un seul état `subscribed`) plutôt qu'une instance propre à /profil.
  const {
    isSupported: pushSupported,
    permission: pushPermission,
    subscribed: isSubscribed,
    isLoading: pushLoading,
    subscribe,
    unsubscribe,
    refresh: refreshOrchestrator,
  } = useNotificationOrchestrator()
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState<string | null>(null)

  // Suppression compte
  const [deletionRequestedAt, setDeletionRequestedAt] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletionLoading, setDeletionLoading] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  // Modal infos perso
  const [showProfilModal, setShowProfilModal] = useState(false)

  // Modal notifications
  const [showNotifModal, setShowNotifModal] = useState(false)

  // Roles / espaces
  const [intraRole, setIntraRole] = useState<IntraRole | null>(null)
  const [orgless, setOrgless] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [isFormateur, setIsFormateur] = useState(false)
  const [isCsMember, setIsCsMember] = useState(false)
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
        .select('notifications_enabled, daily_reminders, live_session_reminders, formateur_publications, weekly_journal, new_formations, cp_reminders, autopilot_reminders, new_tools, leaderboard_results')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (prefs) {
        if (prefs.notifications_enabled != null) setNotificationsEnabled(prefs.notifications_enabled)
        if (prefs.daily_reminders != null) setDailyReminders(prefs.daily_reminders)
        if (prefs.live_session_reminders != null) setLiveSessionReminders(prefs.live_session_reminders)
        if (prefs.formateur_publications != null) setFormateurPublications(prefs.formateur_publications)
        if (prefs.weekly_journal != null) setWeeklyJournal(prefs.weekly_journal)
        if (prefs.new_formations != null) setNewFormations(prefs.new_formations)
        if (prefs.cp_reminders != null) setCpReminders(prefs.cp_reminders)
        if (prefs.autopilot_reminders != null) setAutopilotReminders(prefs.autopilot_reminders)
        if (prefs.new_tools != null) setNewTools(prefs.new_tools)
        if (prefs.leaderboard_results != null) setLeaderboardResults(prefs.leaderboard_results)
      }

      try {
        const res = await fetch('/api/user/intra-role')
        if (res.ok) {
          const json = await res.json()
          setIntraRole((json.intra_role as IntraRole | null) ?? null)
          setOrgless(Boolean(json.orgless))
          setIsSuperAdmin(Boolean(json.is_super_admin))
          setIsFormateur(Boolean(json.is_formateur))
          setIsCsMember(Boolean(json.is_cs_member))
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

  // Valeurs courantes des 9 sous-préférences + leurs setters, indexés par clé.
  const prefValues: Record<PrefKey, boolean> = {
    daily_reminders: dailyReminders,
    cp_reminders: cpReminders,
    autopilot_reminders: autopilotReminders,
    leaderboard_results: leaderboardResults,
    new_formations: newFormations,
    weekly_journal: weeklyJournal,
    formateur_publications: formateurPublications,
    new_tools: newTools,
    live_session_reminders: liveSessionReminders,
  }
  const prefSetters: Record<PrefKey, (v: boolean) => void> = {
    daily_reminders: setDailyReminders,
    cp_reminders: setCpReminders,
    autopilot_reminders: setAutopilotReminders,
    leaderboard_results: setLeaderboardResults,
    new_formations: setNewFormations,
    weekly_journal: setWeeklyJournal,
    formateur_publications: setFormateurPublications,
    new_tools: setNewTools,
    live_session_reminders: setLiveSessionReminders,
  }

  const handleTogglePref = async (key: PrefKey, value: boolean) => {
    if (!user) return
    prefSetters[key](value)
    setSavingPrefs(true)
    try {
      await supabase
        .from('user_notification_preferences')
        .upsert({ user_id: user.id, [key]: value }, { onConflict: 'user_id' })
    } finally {
      setSavingPrefs(false)
    }
  }

  // Interrupteur unifié : consentement de compte (notifications_enabled) +
  // abonnement push de cet appareil (subscribe/unsubscribe).
  const masterOn = pushSupported ? (isSubscribed && notificationsEnabled) : notificationsEnabled

  // Kill-switch de compte : notifications_enabled. Les colonnes individuelles
  // ne sont jamais touchées → un retour de « coupure » retrouve la config
  // exacte gratuitement (pas de snapshot nécessaire).
  const writeMaster = async (value: boolean) => {
    if (!user) return
    setNotificationsEnabled(value)
    setSavingPrefs(true)
    try {
      await supabase
        .from('user_notification_preferences')
        .upsert(
          { user_id: user.id, notifications_enabled: value },
          { onConflict: 'user_id' },
        )
    } finally {
      setSavingPrefs(false)
    }
    await refreshOrchestrator()
  }

  const handleToggleMaster = async () => {
    if (!user) return
    const target = !masterOn
    if (target) {
      // Sur appareil compatible, on tente l'abonnement d'abord : si la
      // permission est refusée, on n'écrit pas le consentement.
      if (pushSupported) {
        const ok = await subscribe()
        if (!ok) return
      }
      await writeMaster(true)
    } else {
      if (pushSupported) await unsubscribe()
      await writeMaster(false)
    }
  }

  const handleTestNotification = async () => {
    setTestStatus('loading')
    setTestMessage(null)
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setTestStatus('success')
        setTestMessage('Notification envoyee !')
      } else {
        setTestStatus('error')
        setTestMessage(data.message || 'Erreur')
      }
    } catch {
      setTestStatus('error')
      setTestMessage('Erreur reseau')
    }
    setTimeout(() => {
      setTestStatus('idle')
      setTestMessage(null)
    }, 3000)
  }

  const handleRequestDeletion = async () => {
    if (deleteConfirmText !== 'SUPPRIMER') return
    setDeletionLoading(true)
    try {
      const res = await fetch('/api/user/delete', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      // Demande enregistree (deletion_requested_at = now()). On ferme la
      // session : a la reconnexion, l'ecran bloquant proposera la reactivation.
      await handleSignOut()
    } catch (err: any) {
      showMessage('error', err.message || 'Erreur')
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
        setIsCsMember(Boolean(json.is_cs_member))
      }
    } catch {
      // Fail silencieux
    }
  }

  const getInitials = () => {
    if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase()
    return email[0]?.toUpperCase() || 'U'
  }

  // deletion_requested_at stocke la date de DEMANDE ; la purge intervient a J+30.
  const formatPurgeDate = (iso: string) =>
    new Date(new Date(iso).getTime() + 30 * 24 * 60 * 60 * 1000)
      .toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  const showTenantLink = intraRole && TENANT_ADMIN_ROLES.has(intraRole)
  const showUpgradeCard = !loading && orgless && !intraRole
  // Comité scientifique : visible pour un membre CS ou un super_admin — même
  // logique que le garde requireCsMemberOrRedirect du layout /cs.
  const showCsLink = isCsMember || isSuperAdmin
  const showEspacesSection =
    isSuperAdmin || isFormateur || showTenantLink || showCsLink

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
                Suppression planifiee le {formatPurgeDate(deletionRequestedAt)}
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
            {/* Interrupteur unifié : consentement de compte + abonnement de cet appareil */}
            <div className="space-y-2">
              <button
                onClick={() => { void handleToggleMaster() }}
                disabled={savingPrefs || pushLoading || pushPermission === 'denied'}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all font-semibold w-full text-left ${
                  masterOn
                    ? 'bg-accent/10 text-accent border border-accent/20'
                    : 'bg-white/5 text-white/70 hover:bg-white/10'
                } ${savingPrefs || pushLoading || pushPermission === 'denied' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {pushLoading ? (
                  <Loader2 className="w-5 h-5 shrink-0 animate-spin" />
                ) : masterOn ? (
                  <Bell className="w-5 h-5 shrink-0" />
                ) : (
                  <BellOff className="w-5 h-5 shrink-0" />
                )}
                <span className="text-sm">Autoriser l&apos;envoi de notifications</span>
              </button>

              {pushPermission === 'denied' && (
                <p className="text-xs text-red-400 px-1">
                  Notifications bloquees par le navigateur. Autorise-les dans les
                  parametres de ton navigateur pour les reactiver.
                </p>
              )}

              {!pushSupported && (
                <p className="text-xs text-white/45 px-1">
                  Les notifications push ne sont pas supportees sur cet appareil.
                </p>
              )}

              {isSubscribed && (
                <button
                  onClick={() => { void handleTestNotification() }}
                  disabled={testStatus === 'loading'}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-sm w-full text-left ${
                    testStatus === 'success'
                      ? 'bg-green-500/10 text-green-400'
                      : testStatus === 'error'
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {testStatus === 'loading'
                    ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                    : <Send className="w-4 h-4 shrink-0" />}
                  <span>{testMessage || 'Envoyer une notification test'}</span>
                </button>
              )}
            </div>

            {/* Personnaliser — replié par défaut, 3 familles visibles d'un coup */}
            <div className={`border-t border-white/10 pt-4 ${masterOn ? '' : 'opacity-40'}`}>
              <button
                onClick={() => setShowCustomize((v) => !v)}
                disabled={!masterOn}
                className={`flex items-center justify-between gap-2 w-full text-left ${!masterOn ? 'cursor-not-allowed' : ''}`}
                aria-expanded={showCustomize}
              >
                <span className="text-sm font-semibold text-white/80">Personnaliser</span>
                <ChevronDown
                  className={`w-4 h-4 text-white/50 transition-transform ${showCustomize ? 'rotate-180' : ''}`}
                />
              </button>

              {showCustomize && (
                <div className="mt-4 space-y-5">
                  {NOTIF_FAMILIES.map((family) => (
                    <div key={family.id} className="space-y-2">
                      <p className="text-xs font-medium text-white/55">{family.label}</p>
                      {family.keys.map(({ key, label, hint }) => (
                        <button
                          key={key}
                          onClick={() => { void handleTogglePref(key, !prefValues[key]) }}
                          disabled={savingPrefs || !masterOn}
                          className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all font-medium w-full text-left ${
                            prefValues[key]
                              ? 'bg-accent/10 text-accent border border-accent/20'
                              : 'bg-white/5 text-white/70 hover:bg-white/10'
                          } ${savingPrefs || !masterOn ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Bell className="w-5 h-5 shrink-0" />
                          {hint ? (
                            <div className="flex-1 text-left">
                              <div className="text-sm">{label}</div>
                              <div className="text-xs opacity-60 font-normal">{hint}</div>
                            </div>
                          ) : (
                            <span className="text-sm">{label}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
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

        {/* Mes espaces — visible si super_admin et/ou formateur.
            Cartes visibles à toutes les largeurs ; sur mobile, le clic mène à
            l'écran « Disponible sur ordinateur » (layouts enveloppés DesktopOnly). */}
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
              {showCsLink && (
                <Link href="/cs" className="glass-card transition-premium block p-4 hover:border-white/20 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                      <BadgeCheck className="w-5 h-5 text-[#8B5CF6]" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-white text-sm">Comité scientifique</div>
                      <div className="text-xs text-white/55">Validez les contenus publiés et co-signez les validations éditoriales.</div>
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

        {/* Déconnexion — carte neutre, séparée visuellement de la zone dangereuse
            (celle-ci est destructive ; se déconnecter est bénin). */}
        <div className="glass-card rounded-2xl p-5">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center justify-between w-full py-2 text-left hover:bg-white/5 rounded-xl px-2 -mx-2 transition-premium"
          >
            <span className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-xl">
                <LogOut className="w-4 h-4 text-white/70" />
              </div>
              <span className="text-sm font-medium text-white">Se déconnecter</span>
            </span>
            <ChevronRight className="w-4 h-4 text-white/40" />
          </button>
        </div>

        {/* Zone dangereuse */}
        <div className="glass-card rounded-2xl p-5" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
          <h3 className="font-semibold text-red-500 mb-1">Zone dangereuse</h3>
          <p className="text-xs text-white/55 mb-4">
            La suppression est irreversible apres 30 jours. Toutes vos donnees seront effacees.
          </p>

          {!deletionRequestedAt && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 text-sm text-red-500 font-medium hover:text-red-400 transition-premium"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer mon compte
            </button>
          )}
        </div>

        {/* Modal — Suppression definitive du compte */}
        <Modal
          open={showDeleteConfirm}
          onClose={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}
          variant="dark"
          size="lg"
          ariaLabel="Supprimer definitivement mon compte"
          className="bg-neutral-900 border border-neutral-800"
        >
          <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-neutral-800">
            <h2 className="font-bold text-red-500 text-base">Supprimer définitivement mon compte</h2>
            <button
              onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-premium"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          <div className="px-6 py-5 max-h-[60vh] overflow-y-auto space-y-4">
            <p className="text-sm text-white/80">
              Avant de continuer, téléchargez vos attestations. Elles ne seront plus
              accessibles depuis l&apos;application après la suppression.
            </p>

            <button
              type="button"
              onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); router.push('/ma-certif/attestations') }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white border border-white/20 hover:bg-white/10 transition-premium"
            >
              <BadgeCheck className="w-4 h-4" />
              Voir mes attestations
            </button>

            <p className="text-sm text-white/80">
              Seront supprimés : votre profil, votre progression, vos points, votre
              historique de certification périodique et vos justificatifs déposés.
            </p>

            <p className="text-sm text-white/60">
              Votre compte sera définitivement supprimé dans 30 jours. Vous pouvez
              annuler à tout moment en vous reconnectant.
            </p>

            <div className="pt-1">
              <label className="block text-xs font-medium text-white/55 mb-1.5">
                Pour confirmer, tapez <span className="font-mono font-semibold text-white/80">SUPPRIMER</span>
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                autoComplete="off"
                placeholder="SUPPRIMER"
                className="w-full px-3 py-2 rounded-xl text-sm bg-neutral-800 border border-neutral-700 text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-neutral-800">
            <button
              onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}
              className="px-4 py-2 text-sm text-white/55 hover:text-white rounded-xl transition-premium"
            >
              Annuler
            </button>
            <button
              onClick={handleRequestDeletion}
              disabled={deletionLoading || deleteConfirmText !== 'SUPPRIMER'}
              className="px-5 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deletionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Supprimer mon compte
            </button>
          </div>
        </Modal>

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
