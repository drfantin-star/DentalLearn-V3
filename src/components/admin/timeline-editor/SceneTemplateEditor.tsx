'use client'

import { useState } from 'react'

import {
  TEMPLATE_KINDS,
  TEMPLATE_KIND_LABELS,
  getDefaultTemplatePayload,
} from '@/lib/timeline/template-defaults'
import type { Scene, SceneTemplate } from '@/lib/timeline/schema'

import { CausalEditor } from './templates/CausalEditor'
import { ComparisonEditor } from './templates/ComparisonEditor'
import { FiguresEditor } from './templates/FiguresEditor'
import { FlowchartEditor } from './templates/FlowchartEditor'
import { GridEditor } from './templates/GridEditor'
import { TimelineTemplateEditor } from './templates/TimelineTemplateEditor'

/**
 * Éditeur de template scène (POC-T6.3).
 *
 * Header : dropdown du `template.kind`.
 * Body  : sous-éditeur selon kind.
 *
 * Changement de kind (D5 — Option A) : modal de confirmation. Si Confirmer,
 * on remplace `scene.template` par le payload vierge issu de
 * `getDefaultTemplatePayload(kind)`. Si Annuler, le state du dropdown
 * revient à l'ancienne valeur (l'état pending est local au composant et
 * réinitialisé).
 */

interface Props {
  scene: Scene
  onChange: (next: Scene) => void
}

export function SceneTemplateEditor({ scene, onChange }: Props) {
  const [pendingKind, setPendingKind] =
    useState<SceneTemplate['kind'] | null>(null)

  function handleSelectKind(next: SceneTemplate['kind']) {
    if (next === scene.template.kind) return
    setPendingKind(next)
  }

  function confirmKindChange() {
    if (!pendingKind) return
    onChange({ ...scene, template: getDefaultTemplatePayload(pendingKind) })
    setPendingKind(null)
  }
  function cancelKindChange() {
    setPendingKind(null)
  }

  function handleTemplateChange(template: SceneTemplate) {
    onChange({ ...scene, template })
  }

  return (
    <section className="space-y-3">
      <h3 className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">
        Template
      </h3>

      <div className="flex items-center gap-2">
        <select
          value={scene.template.kind}
          onChange={(e) =>
            handleSelectKind(e.target.value as SceneTemplate['kind'])
          }
          className="flex-1 rounded-lg border border-white/10 bg-[color:var(--color-bg-input)] px-3 py-2 text-sm text-white focus:border-ds-turquoise focus:outline-none"
        >
          {TEMPLATE_KINDS.map((k) => (
            <option key={k} value={k}>
              {TEMPLATE_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <span className="rounded bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
          {scene.template.kind}
        </span>
      </div>

      <div className="rounded-xl bg-[color:var(--color-bg-card)]/30 p-3">
        <SceneTemplateBody
          template={scene.template}
          onChange={handleTemplateChange}
        />
      </div>

      {pendingKind && (
        <ConfirmKindChangeModal
          fromKind={scene.template.kind}
          toKind={pendingKind}
          onCancel={cancelKindChange}
          onConfirm={confirmKindChange}
        />
      )}
    </section>
  )
}

function SceneTemplateBody({
  template,
  onChange,
}: {
  template: SceneTemplate
  onChange: (next: SceneTemplate) => void
}) {
  switch (template.kind) {
    case 'grid':
      return <GridEditor template={template} onChange={onChange} />
    case 'flowchart':
      return <FlowchartEditor template={template} onChange={onChange} />
    case 'comparison':
      return <ComparisonEditor template={template} onChange={onChange} />
    case 'figures':
      return <FiguresEditor template={template} onChange={onChange} />
    case 'causal':
      return <CausalEditor template={template} onChange={onChange} />
    case 'timeline':
      return <TimelineTemplateEditor template={template} onChange={onChange} />
  }
}

function ConfirmKindChangeModal({
  fromKind,
  toKind,
  onCancel,
  onConfirm,
}: {
  fromKind: SceneTemplate['kind']
  toKind: SceneTemplate['kind']
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl border border-white/10 bg-[color:var(--color-bg-card)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="mb-2 text-sm font-semibold text-white">
          Changer le type de visualisation ?
        </h4>
        <p className="mb-4 text-xs text-[color:var(--color-text-secondary)]">
          Vous passez de <strong>{TEMPLATE_KIND_LABELS[fromKind]}</strong> à{' '}
          <strong>{TEMPLATE_KIND_LABELS[toKind]}</strong>. Le contenu actuel
          de cette scène sera effacé et remplacé par un gabarit vierge.
          Cette action ne peut pas être annulée par retour arrière du
          navigateur (mais vous pouvez quitter sans enregistrer).
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            autoFocus
            className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-500/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  )
}
