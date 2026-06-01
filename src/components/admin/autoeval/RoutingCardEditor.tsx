'use client'

import { useState } from 'react'
import { Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import TextField from '@/components/ui/TextField'
import Textarea from '@/components/ui/Textarea'
import Select from '@/components/ui/Select'
import { updateRoutingCardText } from '@/lib/autoeval/adminMutations'
import type { QuestionnaireRouting, RoutingCard } from '@/lib/autoeval/types'

interface Props {
  routing: QuestionnaireRouting
  onSaved: (message: string) => void
  onError: (message: string) => void
}

const VARIANT_OPTIONS = [
  { value: 'default', label: 'Standard' },
  { value: 'sps', label: 'SPS (entraide / urgence)' },
  { value: 'sensitive', label: 'Sensible' },
]

export default function RoutingCardEditor({ routing, onSaved, onError }: Props) {
  const card = routing.carte
  const [title, setTitle] = useState(card.title)
  const [body, setBody] = useState(card.body)
  const [phone, setPhone] = useState(card.phone ?? '')
  const [variant, setVariant] = useState<RoutingCard['variant']>(card.variant ?? 'default')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) {
      onError('Le titre de la carte est obligatoire.')
      return
    }
    setSaving(true)
    const { error } = await updateRoutingCardText(createClient(), routing, {
      title: title.trim(),
      body: body.trim(),
      phone: phone.trim() || null,
      variant,
    })
    setSaving(false)
    if (error) return onError(`Enregistrement échoué : ${error}`)
    onSaved('Carte de routage mise à jour.')
  }

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span
          className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500"
          title="Clé de routage (non modifiable — câblage)"
        >
          {card.key}
        </span>
      </div>
      <div className="space-y-3">
        <TextField label="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea label="Corps" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label="Téléphone (optionnel)"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Select
            label="Variante"
            value={variant ?? 'default'}
            onChange={(e) => setVariant(e.target.value as RoutingCard['variant'])}
            options={VARIANT_OPTIONS}
          />
        </div>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={handleSave} loading={saving}>
            <Save className="h-4 w-4" /> Enregistrer la carte
          </Button>
        </div>
      </div>
    </div>
  )
}
