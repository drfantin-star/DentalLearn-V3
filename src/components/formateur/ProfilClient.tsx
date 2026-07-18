'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, ExternalLink, Loader2, X } from 'lucide-react'
import { FormateurProfilSchema, type FormateurProfilInput } from '@/lib/schemas/formateur-profil'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormateurProfil {
  id?: string
  user_id?: string
  slug?: string | null
  display_name?: string | null
  bio_long?: string | null
  expertise_tags?: string[] | null
  annees_experience?: number | null
  ville?: string | null
  cabinet_nom?: string | null
  linkedin_url?: string | null
  instagram_url?: string | null
  photo_pro_url?: string | null
  is_published?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

// Redimensionne une image côté client si largeur > 800px
function resizeImageIfNeeded(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      if (img.naturalWidth <= 800) {
        resolve(file)
        return
      }
      const scale = 800 / img.naturalWidth
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = Math.round(img.naturalHeight * scale)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Canvas toBlob failed'))
        },
        mimeType,
        0.88
      )
    }
    img.onerror = reject
    img.src = url
  })
}

// ─── Sous-composant : input "tags" ────────────────────────────────────────────

function TagInput({
  tags,
  onChange,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
}) {
  const [input, setInput] = useState('')

  function addTag(value: string) {
    const trimmed = value.trim()
    if (!trimmed || tags.includes(trimmed) || tags.length >= 20) return
    onChange([...tags, trimmed])
    setInput('')
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  return (
    <div className="flex flex-wrap gap-2 p-2 rounded-lg border border-gray-200 bg-white min-h-[42px]">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 bg-[#EDE9FF] text-primary text-xs font-medium px-2.5 py-1 rounded-full"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="hover:text-red-500 transition-colors"
            aria-label={`Supprimer ${tag}`}
          >
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(input)}
        placeholder={tags.length === 0 ? 'Implantologie, Endodontie…' : ''}
        className="flex-1 min-w-[140px] text-sm outline-none text-gray-900 placeholder:text-gray-400 bg-transparent"
      />
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function ProfilClient() {
  const [profil, setProfil] = useState<FormateurProfil>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Champs du formulaire (string pour les inputs)
  const [bioLong, setBioLong] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [anneesExp, setAnneesExp] = useState('')
  const [ville, setVille] = useState('')
  const [cabinetNom, setCabinetNom] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [isPublished, setIsPublished] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  // Hydrate le formulaire depuis le profil chargé
  const hydrateForm = useCallback((p: FormateurProfil) => {
    setBioLong(p.bio_long ?? '')
    setTags(p.expertise_tags ?? [])
    setAnneesExp(p.annees_experience != null ? String(p.annees_experience) : '')
    setVille(p.ville ?? '')
    setCabinetNom(p.cabinet_nom ?? '')
    setLinkedinUrl(p.linkedin_url ?? '')
    setInstagramUrl(p.instagram_url ?? '')
    setIsPublished(p.is_published ?? false)
    setAvatarUrl(p.photo_pro_url ?? null)
  }, [])

  useEffect(() => {
    fetch('/api/formateur/profil')
      .then((r) => r.json())
      .then((data: FormateurProfil) => {
        setProfil(data)
        hydrateForm(data)
      })
      .catch(() => showToast('Erreur lors du chargement du profil', false))
      .finally(() => setLoading(false))
  }, [hydrateForm])

  // ─── Upload avatar ─────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      showToast('Format non accepté. Utilisez JPEG ou PNG.', false)
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Fichier trop volumineux (max 2 Mo).', false)
      return
    }

    setUploading(true)
    try {
      const blob = await resizeImageIfNeeded(file)
      const resizedFile = new File([blob], file.name, { type: file.type })

      const fd = new FormData()
      fd.append('avatar', resizedFile)

      const res = await fetch('/api/formateur/profil/avatar', { method: 'POST', body: fd })
      const json = await res.json()

      if (!res.ok) {
        showToast(json.error ?? 'Erreur upload', false)
        return
      }

      setAvatarUrl(json.avatar_url)
      showToast('Photo mise à jour', true)
    } catch {
      showToast("Erreur lors de l'upload", false)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ─── Enregistrer ──────────────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    const payload: FormateurProfilInput = {
      bio_long: bioLong || null,
      expertise_tags: tags.length > 0 ? tags : null,
      annees_experience: anneesExp !== '' ? parseInt(anneesExp, 10) : null,
      ville: ville || null,
      cabinet_nom: cabinetNom || null,
      linkedin_url: linkedinUrl || null,
      instagram_url: instagramUrl || null,
      is_published: isPublished,
    }

    const parsed = FormateurProfilSchema.safeParse(payload)
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors
      const errs: Record<string, string> = {}
      for (const [key, msgs] of Object.entries(flat)) {
        if (msgs?.[0]) errs[key] = msgs[0]
      }
      setErrors(errs)
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/formateur/profil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const data = await res.json()

      if (!res.ok) {
        showToast(data.error ?? 'Erreur lors de la sauvegarde', false)
        return
      }

      setProfil(data)
      setIsPublished(data.is_published)
      showToast('Profil enregistré', true)
    } catch {
      showToast('Erreur réseau', false)
    } finally {
      setSaving(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    )
  }

  const displayName = profil.display_name
  const slug = profil.slug

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg transition-all ${
            toast.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <h1 className="text-2xl font-bold text-gray-900">Mon profil public</h1>

      {/* Lien aperçu si publié */}
      {isPublished && slug && (
        <a
          href={`/formateurs/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-[#4C35C9] transition-colors"
        >
          Voir mon profil public
          <ExternalLink size={14} />
        </a>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* ── Photo ─────────────────────────────────────────────────────── */}
        <Card variant="flat" className="p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4">Photo de profil</h2>
          <div className="flex items-center gap-5">
            {/* Avatar ou initiales */}
            <div className="w-20 h-20 rounded-full overflow-hidden bg-[#EDE9FF] flex items-center justify-center shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Photo de profil" className="w-full h-full object-cover" />
              ) : (
                <span className="text-primary text-xl font-bold">
                  {getInitials(displayName)}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 bg-[#EDE9FF] text-primary font-semibold text-sm px-4 py-2 rounded-lg hover:bg-[#DDD6FE] transition-colors disabled:opacity-50"
              >
                {uploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                {uploading ? 'Upload…' : 'Changer la photo'}
              </button>
              <p className="text-xs text-gray-400">JPEG ou PNG · max 2 Mo</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </Card>

        {/* ── Informations ──────────────────────────────────────────────── */}
        <Card variant="flat" className="p-6 shadow-sm space-y-5">
          <h2 className="text-base font-bold text-gray-900">Informations</h2>

          {/* Bio */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Bio</label>
            <textarea
              value={bioLong}
              onChange={(e) => setBioLong(e.target.value)}
              rows={5}
              placeholder="Présentez votre parcours, votre expertise, votre approche pédagogique…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
            />
            {errors.bio_long && <p className="text-red-500 text-xs mt-1">{errors.bio_long}</p>}
          </div>

          {/* Spécialités */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Spécialités{' '}
              <span className="font-normal text-gray-400">(Entrée ou virgule pour ajouter)</span>
            </label>
            <TagInput tags={tags} onChange={setTags} />
            {errors.expertise_tags && (
              <p className="text-red-500 text-xs mt-1">{errors.expertise_tags}</p>
            )}
          </div>

          {/* Années d'expérience */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Années d'expérience
            </label>
            <input
              type="number"
              min={0}
              max={60}
              value={anneesExp}
              onChange={(e) => setAnneesExp(e.target.value)}
              placeholder="Ex : 12"
              className="w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            {errors.annees_experience && (
              <p className="text-red-500 text-xs mt-1">{errors.annees_experience}</p>
            )}
          </div>

          {/* Ville */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Ville</label>
            <input
              type="text"
              value={ville}
              onChange={(e) => setVille(e.target.value)}
              placeholder="Paris"
              maxLength={120}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Cabinet */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Nom du cabinet
            </label>
            <input
              type="text"
              value={cabinetNom}
              onChange={(e) => setCabinetNom(e.target.value)}
              placeholder="Cabinet dentaire du Louvre"
              maxLength={200}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
        </Card>

        {/* ── Réseaux sociaux ────────────────────────────────────────────── */}
        <Card variant="flat" className="p-6 shadow-sm space-y-5">
          <h2 className="text-base font-bold text-gray-900">Réseaux sociaux</h2>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              LinkedIn
            </label>
            <input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            {errors.linkedin_url && (
              <p className="text-red-500 text-xs mt-1">{errors.linkedin_url}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Instagram
            </label>
            <input
              type="url"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="https://instagram.com/..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            {errors.instagram_url && (
              <p className="text-red-500 text-xs mt-1">{errors.instagram_url}</p>
            )}
          </div>
        </Card>

        {/* ── Visibilité ────────────────────────────────────────────────── */}
        <Card variant="flat" className="p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-gray-900">Publier mon profil</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Votre profil sera visible par tous les utilisateurs connectés sur{' '}
                {slug ? <span className="font-medium">/formateurs/{slug}</span> : 'votre URL publique'}.
              </p>
            </div>
            {/* Toggle switch */}
            <button
              type="button"
              role="switch"
              aria-checked={isPublished}
              onClick={() => setIsPublished(!isPublished)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isPublished ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform ring-0 transition duration-200 ease-in-out ${
                  isPublished ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </Card>

        {/* ── Bouton enregistrer ────────────────────────────────────────── */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          loading={saving}
          disabled={saving}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </form>
    </div>
  )
}
