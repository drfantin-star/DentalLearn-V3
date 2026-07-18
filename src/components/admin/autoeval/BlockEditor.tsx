'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Lock, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import TextField from '@/components/ui/TextField'
import Textarea from '@/components/ui/Textarea'
import {
  updateBlockRecapMessages,
  updateBlockRecapNeutral,
  updateBlockTitre,
  updateItemLabels,
  updateItemOptionLabels,
} from '@/lib/autoeval/adminMutations'
import type { QuestionnaireBlock, QuestionnaireItem } from '@/lib/autoeval/types'

interface BlockEditorProps {
  block: QuestionnaireBlock
  onSaved: (message: string) => void
  onError: (message: string) => void
}

const TYPE_LABELS: Record<string, string> = {
  cbi: 'Burnout (CBI)',
  reflexif: 'Réflexif',
  substances: 'Substances',
  factuel: 'Repères factuels',
}

export default function BlockEditor({ block, onSaved, onError }: BlockEditorProps) {
  const [open, setOpen] = useState(false)
  const locked = block.verrouille

  return (
    <section className="rounded-2xl border border-gray-200 bg-white">
      {/* En-tête du bloc */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
        )}
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
          {block.ordre}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-gray-900">{block.titre}</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {locked && <Lock className="h-3 w-3" />}
          {TYPE_LABELS[block.type_bloc] ?? block.type_bloc}
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4">
          {locked ? (
            <LockedBlockView block={block} />
          ) : (
            <EditableBlockView block={block} onSaved={onSaved} onError={onError} />
          )}
        </div>
      )}
    </section>
  )
}

// ── Bloc verrouillé (CBI) : lecture seule + bandeau ────────────────────────

function LockedBlockView({ block }: { block: QuestionnaireBlock }) {
  return (
    <div>
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-pink-500/30 bg-pink-500/5 px-4 py-3">
        <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-pink-500" />
        <p className="text-sm text-gray-700">
          <span className="font-semibold">Instrument validé (Copenhagen Burnout Inventory)</span>{' '}
          — non modifiable. Items, options, ordre et règles de scoring sont figés.
        </p>
      </div>
      <ul className="space-y-1.5">
        {block.items.map((item) => (
          <li key={item.id} className="flex gap-3 text-sm text-gray-500">
            <span className="font-mono text-xs text-gray-400">{item.ordre}.</span>
            <span>{item.libelle}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Bloc éditable (reflexif / substances / factuel) ────────────────────────

function EditableBlockView({
  block,
  onSaved,
  onError,
}: {
  block: QuestionnaireBlock
  onSaved: (m: string) => void
  onError: (m: string) => void
}) {
  const [titre, setTitre] = useState(block.titre)
  const [savingTitre, setSavingTitre] = useState(false)

  const handleSaveTitre = async () => {
    if (!titre.trim()) {
      onError('Le titre du bloc est obligatoire.')
      return
    }
    setSavingTitre(true)
    const { error } = await updateBlockTitre(createClient(), block, titre.trim())
    setSavingTitre(false)
    if (error) return onError(`Enregistrement échoué : ${error}`)
    onSaved('Titre du bloc mis à jour.')
  }

  return (
    <div className="space-y-6">
      {/* Titre du bloc */}
      <div className="flex items-end gap-3">
        <TextField
          label="Titre du bloc"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
        />
        <Button variant="secondary" onClick={handleSaveTitre} loading={savingTitre}>
          <Save className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages de récap (shape-aware) */}
      <RecapEditor block={block} onSaved={onSaved} onError={onError} />

      {/* Items */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400">
          Items ({block.items.length})
        </h3>
        <div className="space-y-4">
          {block.items.map((item) => (
            <ItemEditor key={item.id} item={item} onSaved={onSaved} onError={onError} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Éditeur de récap shape-aware ───────────────────────────────────────────

function RecapEditor({
  block,
  onSaved,
  onError,
}: {
  block: QuestionnaireBlock
  onSaved: (m: string) => void
  onError: (m: string) => void
}) {
  const recap = (block.recap_config ?? {}) as Record<string, unknown>
  const hasMessages =
    recap.messages != null && typeof recap.messages === 'object'
  const hasNeutral = typeof recap.neutralMessage === 'string'

  const messages = (recap.messages ?? {}) as Record<string, string>

  const [vert, setVert] = useState(messages.vert ?? '')
  const [orange, setOrange] = useState(messages.orange ?? '')
  const [rouge, setRouge] = useState(messages.rouge ?? '')
  const [neutral, setNeutral] = useState(
    typeof recap.neutralMessage === 'string' ? recap.neutralMessage : ''
  )
  const [saving, setSaving] = useState(false)

  if (!hasMessages && !hasNeutral) return null // bloc factuel : pas de récap

  const handleSaveMessages = async () => {
    setSaving(true)
    const { error } = await updateBlockRecapMessages(createClient(), block, {
      vert,
      orange,
      rouge,
    })
    setSaving(false)
    if (error) return onError(`Enregistrement échoué : ${error}`)
    onSaved('Messages de récap mis à jour.')
  }

  const handleSaveNeutral = async () => {
    setSaving(true)
    const { error } = await updateBlockRecapNeutral(createClient(), block, neutral)
    setSaving(false)
    if (error) return onError(`Enregistrement échoué : ${error}`)
    onSaved('Message de récap mis à jour.')
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400">
        Messages de récapitulatif
      </h3>
      {hasMessages ? (
        <div className="space-y-3">
          <Textarea
            label="Message — niveau vert (favorable)"
            rows={2}
            value={vert}
            onChange={(e) => setVert(e.target.value)}
          />
          <Textarea
            label="Message — niveau orange (vigilance)"
            rows={2}
            value={orange}
            onChange={(e) => setOrange(e.target.value)}
          />
          <Textarea
            label="Message — niveau rouge (alerte)"
            rows={2}
            value={rouge}
            onChange={(e) => setRouge(e.target.value)}
          />
          <div className="flex justify-end">
            <Button variant="secondary" onClick={handleSaveMessages} loading={saving}>
              <Save className="h-4 w-4" /> Enregistrer les messages
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Textarea
            label="Message neutre"
            rows={2}
            value={neutral}
            onChange={(e) => setNeutral(e.target.value)}
            hint="Affiché en récapitulatif de ce bloc (non scoré)."
          />
          <div className="flex justify-end">
            <Button variant="secondary" onClick={handleSaveNeutral} loading={saving}>
              <Save className="h-4 w-4" /> Enregistrer le message
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Éditeur d'item ─────────────────────────────────────────────────────────

function ItemEditor({
  item,
  onSaved,
  onError,
}: {
  item: QuestionnaireItem
  onSaved: (m: string) => void
  onError: (m: string) => void
}) {
  const [libelle, setLibelle] = useState(item.libelle)
  const [libelleEn, setLibelleEn] = useState(item.libelle_en ?? '')
  const [optionLabels, setOptionLabels] = useState<string[]>(
    (item.options ?? []).map((o) => o.label)
  )
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!libelle.trim()) {
      onError('Le libellé de l’item est obligatoire.')
      return
    }
    setSaving(true)
    const client = createClient()

    const labelsResult = await updateItemLabels(client, item, {
      libelle: libelle.trim(),
      libelle_en: libelleEn.trim() || null,
    })
    if (labelsResult.error) {
      setSaving(false)
      return onError(`Enregistrement échoué : ${labelsResult.error}`)
    }

    if ((item.options ?? []).length > 0) {
      const optResult = await updateItemOptionLabels(client, item, optionLabels)
      if (optResult.error) {
        setSaving(false)
        return onError(`Enregistrement échoué : ${optResult.error}`)
      }
    }

    setSaving(false)
    onSaved('Item mis à jour.')
  }

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <div className="space-y-3">
        <TextField
          label={`Libellé (item ${item.ordre})`}
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
        />
        <TextField
          label="Libellé anglais (optionnel)"
          value={libelleEn}
          onChange={(e) => setLibelleEn(e.target.value)}
        />

        {(item.options ?? []).length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Options
            </p>
            <div className="space-y-2">
              {(item.options ?? []).map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span
                    className="inline-flex h-8 min-w-[44px] flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 px-2 font-mono text-xs text-gray-500"
                    title="Valeur (non modifiable — pilote le scoring)"
                  >
                    {String(opt.value)}
                  </span>
                  <input
                    value={optionLabels[i] ?? ''}
                    onChange={(e) =>
                      setOptionLabels((prev) => {
                        const next = [...prev]
                        next[i] = e.target.value
                        return next
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                    aria-label={`Libellé de l'option de valeur ${opt.value}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* factual_card : repère en lecture seule (câblage non éditable) */}
        {item.factual_card && (
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            Carte ressource liée :{' '}
            <span className="font-mono">{item.factual_card.routeKey}</span> (déclenchée sur{' '}
            {item.factual_card.triggerValues.map((v) => String(v)).join(', ')}) — câblage non
            modifiable.
          </p>
        )}

        <div className="flex justify-end">
          <Button variant="secondary" onClick={handleSave} loading={saving}>
            <Save className="h-4 w-4" /> Enregistrer l'item
          </Button>
        </div>
      </div>
    </div>
  )
}
