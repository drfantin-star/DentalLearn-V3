'use client'

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import TextField from '@/components/ui/TextField'
import Textarea from '@/components/ui/Textarea'
import type { CabinetComplianceCategory } from '@/lib/supabase/types'
import { FORBIDDEN_COLORS, VALID_ICON_NAMES } from './constants'

interface ComplianceCategoryFormModalProps {
  open: boolean
  onClose: () => void
  existing: CabinetComplianceCategory | null // null = création
  existingCodes: string[] // codes déjà pris (unicité côté client en création)
  onSaved: (message: string) => void
}

export default function ComplianceCategoryFormModal({
  open,
  onClose,
  existing,
  existingCodes,
  onSaved,
}: ComplianceCategoryFormModalProps) {
  const isEdit = existing !== null

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('')
  const [color, setColor] = useState('#6366F1')
  const [displayOrder, setDisplayOrder] = useState(100)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (existing) {
      setCode(existing.code)
      setName(existing.name)
      setDescription(existing.description ?? '')
      setIcon(existing.icon ?? '')
      setColor(existing.color ?? '#6366F1')
      setDisplayOrder(existing.display_order)
    } else {
      setCode('')
      setName('')
      setDescription('')
      setIcon('')
      setColor('#6366F1')
      setDisplayOrder(100)
    }
  }, [open, existing])

  const validate = (): string | null => {
    if (!name.trim()) return 'Le nom est obligatoire.'
    if (!isEdit) {
      const c = code.trim()
      if (!c) return 'Le code est obligatoire.'
      if (!/^[a-z0-9_]+$/.test(c)) {
        return 'Le code ne doit contenir que minuscules, chiffres et underscores.'
      }
      if (existingCodes.includes(c)) return 'Ce code est déjà utilisé.'
    }
    if (color.trim() && FORBIDDEN_COLORS.includes(color.trim().toLowerCase())) {
      return 'Cette couleur est interdite par le brand kit.'
    }
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
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        icon: icon.trim() || null,
        color: color.trim() || null,
        display_order: displayOrder,
      }

      if (isEdit) {
        const { error: updErr } = await supabase
          .from('cabinet_compliance_categories')
          .update(payload)
          .eq('id', existing!.id)
        if (updErr) throw new Error(updErr.message)
        onSaved('Catégorie mise à jour.')
      } else {
        const { error: insErr } = await supabase
          .from('cabinet_compliance_categories')
          .insert({ ...payload, code: code.trim() })
        if (insErr) throw new Error(insErr.message)
        onSaved('Catégorie ajoutée.')
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} variant="light" size="md" ariaLabel="Formulaire catégorie conformité">
      <Modal.Header title={isEdit ? 'Modifier la catégorie' : 'Ajouter une catégorie'} onClose={onClose} />
      <Modal.Body>
        <div className="space-y-4">
          <TextField
            label="Code"
            required={!isEdit}
            disabled={isEdit}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ex. radioprotection"
            hint={
              isEdit
                ? 'Le code (clé naturelle) ne peut pas être modifié.'
                : 'Minuscules, chiffres et underscores. Unique.'
            }
          />

          <TextField
            label="Nom"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. Radioprotection"
          />

          <Textarea
            label="Description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Courte description (facultatif)"
          />

          <div>
            <TextField
              label="Icône (nom lucide)"
              list="conformite-icons"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="ex. shield"
              hint="Nom d'icône lucide. Une valeur inconnue retombe sur ShieldCheck."
            />
            <datalist id="conformite-icons">
              {VALID_ICON_NAMES.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Couleur</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#6366F1'}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-14 rounded-lg border border-gray-300 cursor-pointer"
                aria-label="Sélecteur de couleur"
              />
              <TextField
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#6366F1"
                fullWidth
              />
            </div>
          </div>

          <TextField
            label="Ordre"
            required
            type="number"
            value={String(displayOrder)}
            onChange={(e) => setDisplayOrder(Number(e.target.value))}
            hint="Tri croissant des catégories (défaut 100)"
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
