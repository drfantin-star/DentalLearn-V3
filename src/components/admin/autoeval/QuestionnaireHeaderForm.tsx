'use client'

import { useState } from 'react'
import { Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import TextField from '@/components/ui/TextField'
import Textarea from '@/components/ui/Textarea'
import { updateQuestionnaireHeader } from '@/lib/autoeval/adminMutations'
import type { AdminQuestionnaire } from '@/lib/autoeval/useAdminQuestionnaireDefinition'

interface Props {
  questionnaire: AdminQuestionnaire
  onSaved: (message: string) => void
  onError: (message: string) => void
}

export default function QuestionnaireHeaderForm({ questionnaire, onSaved, onError }: Props) {
  const [titre, setTitre] = useState(questionnaire.titre)
  const [description, setDescription] = useState(questionnaire.description ?? '')
  const [introText, setIntroText] = useState(questionnaire.intro_text ?? '')
  const [timeEstimate, setTimeEstimate] = useState(
    questionnaire.time_estimate_min != null ? String(questionnaire.time_estimate_min) : ''
  )
  const [actif, setActif] = useState(questionnaire.actif)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!titre.trim()) {
      onError('Le titre est obligatoire.')
      return
    }
    const minutes = timeEstimate.trim() === '' ? null : Number(timeEstimate)
    if (minutes != null && !Number.isFinite(minutes)) {
      onError('La durée estimée doit être un nombre.')
      return
    }
    setSaving(true)
    const { error } = await updateQuestionnaireHeader(createClient(), questionnaire.id, {
      titre: titre.trim(),
      description: description.trim() || null,
      intro_text: introText.trim() || null,
      time_estimate_min: minutes,
      actif,
    })
    setSaving(false)
    if (error) {
      onError(`Enregistrement échoué : ${error}`)
      return
    }
    onSaved('En-tête du questionnaire mis à jour.')
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">
        Informations générales
      </h2>
      <div className="space-y-4">
        <TextField
          label="Titre"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          required
        />
        <Textarea
          label="Description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Textarea
          label="Texte d'introduction"
          rows={3}
          value={introText}
          onChange={(e) => setIntroText(e.target.value)}
          hint="Affiché en tête du parcours utilisateur."
        />
        <TextField
          label="Durée estimée (minutes)"
          type="number"
          inputMode="numeric"
          value={timeEstimate}
          onChange={(e) => setTimeEstimate(e.target.value)}
          className="max-w-[200px]"
        />

        {/* Toggle actif */}
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-900">Questionnaire actif</p>
            <p className="text-xs text-gray-500">
              S'il est inactif, il n'apparaît plus dans le parcours utilisateur.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={actif}
            aria-label="Activer ou désactiver le questionnaire"
            onClick={() => setActif((v) => !v)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
              actif ? 'bg-pink-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                actif ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex justify-end">
          <Button variant="primary" onClick={handleSave} loading={saving}>
            <Save className="h-4 w-4" /> Enregistrer
          </Button>
        </div>
      </div>
    </section>
  )
}
