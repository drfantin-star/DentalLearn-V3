'use client'

import { useEffect, useRef, useState } from 'react'
import { Upload, FileText, X, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import TextField from '@/components/ui/TextField'
import Textarea from '@/components/ui/Textarea'
import Select from '@/components/ui/Select'
import { AXE_LABELS, type AxeId, type BibliothequeRessourceRow } from '@/lib/bibliotheque/types'

const BUCKET = 'bibliotheque-publique'
const MAX_PDF_SIZE = 10 * 1024 * 1024 // 10 MB
const SOURCE_SUGGESTIONS = ['DentalLearn', 'ADF', 'SFCO', 'HAS', 'INRS', 'ANSM', 'CNOM']

interface RessourceFormModalProps {
  open: boolean
  onClose: () => void
  axe: AxeId // axe actif (pré-remplit le formulaire en création)
  existing: BibliothequeRessourceRow | null // null = création
  existingCategories: string[] // datalist des catégories de l'axe
  onSaved: (message: string) => void
}

// Slug ASCII safe pour le nom de fichier Storage.
function slugify(input: string): string {
  const s = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return s || 'ressource'
}

export default function RessourceFormModal({
  open,
  onClose,
  axe,
  existing,
  existingCategories,
  onSaved,
}: RessourceFormModalProps) {
  const isEdit = existing !== null

  const [formAxe, setFormAxe] = useState<AxeId>(axe)
  const [titre, setTitre] = useState('')
  const [source, setSource] = useState('')
  const [description, setDescription] = useState('')
  const [categorie, setCategorie] = useState('')
  const [type, setType] = useState<'external' | 'internal'>('external')
  const [url, setUrl] = useState('')
  const [ordre, setOrdre] = useState(100)
  const [file, setFile] = useState<File | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // (Ré)initialise le formulaire à chaque ouverture / changement de ressource.
  useEffect(() => {
    if (!open) return
    setError(null)
    setFile(null)
    if (existing) {
      setFormAxe(existing.axe)
      setTitre(existing.titre)
      setSource(existing.source)
      setDescription(existing.description ?? '')
      setCategorie(existing.categorie ?? '')
      setType(existing.type)
      setUrl(existing.url)
      setOrdre(existing.ordre)
    } else {
      setFormAxe(axe)
      setTitre('')
      setSource('')
      setDescription('')
      setCategorie('')
      setType('external')
      setUrl('')
      setOrdre(100)
    }
  }, [open, existing, axe])

  const handleFilePick = (f: File | undefined) => {
    if (!f) return
    if (f.type !== 'application/pdf') {
      setError('Le fichier doit être un PDF.')
      return
    }
    if (f.size > MAX_PDF_SIZE) {
      setError('PDF trop volumineux (max 10 MB).')
      return
    }
    setError(null)
    setFile(f)
  }

  const validate = (): string | null => {
    if (!titre.trim()) return 'Le titre est obligatoire.'
    if (titre.length > 200) return 'Le titre ne doit pas dépasser 200 caractères.'
    if (!source.trim()) return 'La source est obligatoire.'
    if (description.length > 300) return 'La description ne doit pas dépasser 300 caractères.'
    if (type === 'external') {
      if (!url.trim()) return "L'URL est obligatoire pour une ressource externe."
      try {
        const parsed = new URL(url.trim())
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return "L'URL doit commencer par http(s)://."
        }
      } catch {
        return "L'URL n'est pas valide."
      }
    }
    if (type === 'internal' && !isEdit && !file) {
      return 'Un fichier PDF est obligatoire pour une ressource interne.'
    }
    if (!Number.isFinite(ordre)) return "L'ordre doit être un nombre."
    return null
  }

  const handleSubmit = async () => {
    const v = validate()
    if (v) {
      setError(v)
      return
    }
    setSaving(true)
    setError(null)

    const supabase = createClient()

    try {
      let finalUrl = url.trim()
      let finalStoragePath: string | null = existing?.storage_path ?? null

      if (type === 'internal' && file) {
        // Upload au submit (pattern aligné sur MediaUpload / profil edit) :
        // convention de chemin propre axe{N}/{slug}-{timestamp}.pdf.
        const path = `axe${formAxe}/${slugify(titre)}-${Date.now()}.pdf`
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: 'application/pdf', upsert: false })
        if (upErr) throw new Error(`Upload échoué : ${upErr.message}`)

        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
        finalUrl = pub.publicUrl
        finalStoragePath = path
      }

      if (type === 'external') {
        finalStoragePath = null
      }

      const payload = {
        axe: formAxe,
        titre: titre.trim(),
        source: source.trim(),
        description: description.trim() || null,
        type,
        url: finalUrl,
        storage_path: finalStoragePath,
        categorie: categorie.trim() || null,
        ordre,
      }

      if (isEdit) {
        const { error: updErr } = await supabase
          .from('bibliotheque_ressources')
          .update(payload)
          .eq('id', existing!.id)
        if (updErr) throw new Error(updErr.message)
        onSaved('Ressource mise à jour.')
      } else {
        const { error: insErr } = await supabase
          .from('bibliotheque_ressources')
          .insert(payload)
        if (insErr) throw new Error(insErr.message)
        onSaved('Ressource ajoutée.')
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue.')
    } finally {
      setSaving(false)
    }
  }

  const existingFileName = existing?.storage_path
    ? decodeURIComponent(existing.storage_path.split('/').pop() || '')
    : null

  return (
    <Modal open={open} onClose={onClose} variant="light" size="lg" ariaLabel="Formulaire ressource">
      <Modal.Header title={isEdit ? 'Modifier la ressource' : 'Ajouter une ressource'} onClose={onClose} />
      <Modal.Body>
        <div className="space-y-4">
          <Select
            label="Axe"
            required
            value={String(formAxe)}
            onChange={(e) => setFormAxe(Number(e.target.value) as AxeId)}
            options={[
              { value: '1', label: AXE_LABELS[1] },
              { value: '3', label: AXE_LABELS[3] },
              { value: '4', label: AXE_LABELS[4] },
            ]}
          />

          <TextField
            label="Titre"
            required
            maxLength={200}
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Ex. Formulaires de consentement éclairé"
          />

          <div>
            <TextField
              label="Source"
              required
              list="biblio-sources"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="DentalLearn, ADF, SFCO, HAS…"
            />
            <datalist id="biblio-sources">
              {SOURCE_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <Textarea
            label="Description"
            rows={2}
            maxLength={300}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            hint={`${description.length}/300`}
            placeholder="Une ligne de contexte (facultatif)"
          />

          <div>
            <TextField
              label="Catégorie"
              list="biblio-categories"
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              placeholder="Ex. Consentements (facultatif)"
            />
            <datalist id="biblio-categories">
              {existingCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          {/* Type */}
          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-2">
              Type <span className="text-red-500">*</span>
            </legend>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="biblio-type"
                  checked={type === 'external'}
                  onChange={() => setType('external')}
                  className="accent-primary"
                />
                Lien externe
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="biblio-type"
                  checked={type === 'internal'}
                  onChange={() => setType('internal')}
                  className="accent-primary"
                />
                PDF interne
              </label>
            </div>
          </fieldset>

          {type === 'external' ? (
            <TextField
              label="URL"
              required
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fichier PDF {!isEdit && <span className="text-red-500">*</span>}
              </label>

              {file ? (
                <div className="flex items-center gap-3 rounded-xl border-2 border-gray-200 bg-gray-50 p-3">
                  <FileText className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    aria-label="Retirer le fichier sélectionné"
                    className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 p-6 text-center hover:border-primary hover:bg-gray-50 transition-colors"
                >
                  <Upload className="w-6 h-6 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">
                    Cliquez pour choisir un PDF
                  </span>
                  <span className="text-xs text-gray-500">PDF uniquement · max 10 MB</span>
                </button>
              )}

              {isEdit && !file && existingFileName && (
                <p className="mt-2 text-xs text-gray-500">
                  Fichier actuel conservé : <span className="font-medium">{existingFileName}</span>
                </p>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => handleFilePick(e.target.files?.[0])}
              />
            </div>
          )}

          <TextField
            label="Ordre"
            required
            type="number"
            value={String(ordre)}
            onChange={(e) => setOrdre(Number(e.target.value))}
            hint="Tri croissant dans la catégorie (défaut 100)"
          />

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Annuler
        </Button>
        <Button variant="primary" onClick={handleSubmit} loading={saving}>
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…
            </span>
          ) : isEdit ? (
            'Enregistrer'
          ) : (
            'Ajouter'
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
