'use client'

import { useEffect, useRef, useState } from 'react'
import { Upload, FileText, X, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import TextField from '@/components/ui/TextField'
import Textarea from '@/components/ui/Textarea'
import Select from '@/components/ui/Select'
import type {
  CabinetComplianceCategory,
  CabinetComplianceItem,
  ComplianceAppliesWhen,
} from '@/lib/supabase/types'
import {
  APPLIES_WHEN_OPTIONS,
  FREQUENCY_OPTIONS,
  FICHE_BUCKET,
  MAX_PDF_SIZE,
  slugify,
} from './constants'

interface ComplianceItemFormModalProps {
  open: boolean
  onClose: () => void
  categories: CabinetComplianceCategory[]
  existing: CabinetComplianceItem | null // null = création
  defaultCategoryId?: string // pré-sélection en création
  existingCodes: string[] // codes déjà pris (unicité côté client en création)
  onSaved: (message: string) => void
}

export default function ComplianceItemFormModal({
  open,
  onClose,
  categories,
  existing,
  defaultCategoryId,
  existingCodes,
  onSaved,
}: ComplianceItemFormModalProps) {
  const isEdit = existing !== null

  const [categoryId, setCategoryId] = useState('')
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [frequency, setFrequency] = useState('')
  const [appliesWhen, setAppliesWhen] = useState<ComplianceAppliesWhen>('always')
  const [isMandatory, setIsMandatory] = useState(true)
  const [referenceText, setReferenceText] = useState('')
  const [officialUrl, setOfficialUrl] = useState('')
  const [helpUrl, setHelpUrl] = useState('')
  const [displayOrder, setDisplayOrder] = useState(100)
  const [file, setFile] = useState<File | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // (Ré)initialise le formulaire à chaque ouverture / changement d'item.
  useEffect(() => {
    if (!open) return
    setError(null)
    setFile(null)
    if (existing) {
      setCategoryId(existing.category_id)
      setCode(existing.code)
      setTitle(existing.title)
      setDescription(existing.description ?? '')
      setFrequency(existing.frequency ?? '')
      setAppliesWhen(existing.applies_when)
      setIsMandatory(existing.is_mandatory)
      setReferenceText(existing.reference_text ?? '')
      setOfficialUrl(existing.official_url ?? '')
      setHelpUrl(existing.help_url ?? '')
      setDisplayOrder(existing.display_order)
    } else {
      setCategoryId(defaultCategoryId ?? categories[0]?.id ?? '')
      setCode('')
      setTitle('')
      setDescription('')
      setFrequency('')
      setAppliesWhen('always')
      setIsMandatory(true)
      setReferenceText('')
      setOfficialUrl('')
      setHelpUrl('')
      setDisplayOrder(100)
    }
  }, [open, existing, defaultCategoryId, categories])

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

  const validateUrl = (value: string, label: string): string | null => {
    if (!value.trim()) return null
    try {
      const parsed = new URL(value.trim())
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return `${label} doit commencer par http(s)://.`
      }
    } catch {
      return `${label} n'est pas valide.`
    }
    return null
  }

  const validate = (): string | null => {
    if (!categoryId) return 'La catégorie est obligatoire.'
    if (!title.trim()) return 'Le titre est obligatoire.'
    if (title.length > 200) return 'Le titre ne doit pas dépasser 200 caractères.'
    if (!isEdit) {
      const c = code.trim()
      if (!c) return 'Le code est obligatoire.'
      if (!/^[a-z0-9_]+$/.test(c)) {
        return 'Le code ne doit contenir que minuscules, chiffres et underscores.'
      }
      if (existingCodes.includes(c)) return 'Ce code est déjà utilisé.'
    }
    const offErr = validateUrl(officialUrl, "L'URL officielle")
    if (offErr) return offErr
    const helpErr = validateUrl(helpUrl, "L'URL d'aide")
    if (helpErr) return helpErr
    if (!Number.isFinite(displayOrder)) return "L'ordre doit être un nombre."
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
      let ficheUrl: string | null = existing?.fiche_url ?? null
      let ficheStoragePath: string | null = existing?.fiche_storage_path ?? null

      if (file) {
        // Upload au submit (préfixe distinct des axes biblio : conformite/).
        const path = `conformite/${slugify(code || title)}-${Date.now()}.pdf`
        const { error: upErr } = await supabase.storage
          .from(FICHE_BUCKET)
          .upload(path, file, { contentType: 'application/pdf', upsert: false })
        if (upErr) throw new Error(`Upload échoué : ${upErr.message}`)

        const { data: pub } = supabase.storage.from(FICHE_BUCKET).getPublicUrl(path)
        ficheUrl = pub.publicUrl
        ficheStoragePath = path
      }

      const payload = {
        category_id: categoryId,
        title: title.trim(),
        description: description.trim() || null,
        frequency: frequency || null,
        applies_when: appliesWhen,
        is_mandatory: isMandatory,
        reference_text: referenceText.trim() || null,
        official_url: officialUrl.trim() || null,
        help_url: helpUrl.trim() || null,
        fiche_url: ficheUrl,
        fiche_storage_path: ficheStoragePath,
        display_order: displayOrder,
      }

      if (isEdit) {
        const { error: updErr } = await supabase
          .from('cabinet_compliance_items')
          .update(payload)
          .eq('id', existing!.id)
        if (updErr) throw new Error(updErr.message)
        onSaved('Item mis à jour.')
      } else {
        const { error: insErr } = await supabase
          .from('cabinet_compliance_items')
          .insert({ ...payload, code: code.trim() })
        if (insErr) throw new Error(insErr.message)
        onSaved('Item ajouté.')
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue.')
    } finally {
      setSaving(false)
    }
  }

  const existingFicheName = existing?.fiche_storage_path
    ? decodeURIComponent(existing.fiche_storage_path.split('/').pop() || '')
    : null

  return (
    <Modal open={open} onClose={onClose} variant="light" size="lg" ariaLabel="Formulaire item conformité">
      <Modal.Header title={isEdit ? "Modifier l'item" : 'Ajouter un item'} onClose={onClose} />
      <Modal.Body>
        <div className="space-y-4">
          <Select
            label="Catégorie"
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            placeholder="Choisir une catégorie"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />

          <TextField
            label="Titre"
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex. Suivi dosimétrique"
          />

          <TextField
            label="Code"
            required={!isEdit}
            disabled={isEdit}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ex. dosimetrie"
            hint={
              isEdit
                ? 'Le code (clé naturelle) ne peut pas être modifié.'
                : 'Minuscules, chiffres et underscores. Unique.'
            }
          />

          <Textarea
            label="Description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Contexte (facultatif)"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Fréquence"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              placeholder="—"
              options={FREQUENCY_OPTIONS}
            />
            <Select
              label="Applicabilité"
              value={appliesWhen}
              onChange={(e) => setAppliesWhen(e.target.value as ComplianceAppliesWhen)}
              options={APPLIES_WHEN_OPTIONS}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isMandatory}
              onChange={(e) => setIsMandatory(e.target.checked)}
              className="accent-primary"
            />
            Obligatoire (sinon « Recommandé »)
          </label>

          <Textarea
            label="Référence réglementaire"
            rows={2}
            value={referenceText}
            onChange={(e) => setReferenceText(e.target.value)}
            placeholder="Ex. C. travail R.4451-64 et s. ; suivi dosimétrique"
          />

          <TextField
            label="URL officielle"
            type="url"
            inputMode="url"
            value={officialUrl}
            onChange={(e) => setOfficialUrl(e.target.value)}
            placeholder="https://… (facultatif)"
          />

          <TextField
            label="URL d'aide"
            type="url"
            inputMode="url"
            value={helpUrl}
            onChange={(e) => setHelpUrl(e.target.value)}
            placeholder="https://… (facultatif)"
          />

          {/* Fiche PDF */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fiche (PDF interne, facultatif)
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

            {isEdit && !file && existingFicheName && (
              <p className="mt-2 text-xs text-gray-500">
                Fiche actuelle conservée : <span className="font-medium">{existingFicheName}</span>
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

          <TextField
            label="Ordre"
            required
            type="number"
            value={String(displayOrder)}
            onChange={(e) => setDisplayOrder(Number(e.target.value))}
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
