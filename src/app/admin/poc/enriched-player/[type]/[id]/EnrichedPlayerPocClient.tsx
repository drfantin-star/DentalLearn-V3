'use client'

// POC-T7.2 — Page démo Client Component.
//
// Monte un <AudioProvider> *local* à la page : les routes /admin/* ne sont
// pas wrappées par le `(app)/layout.tsx` qui fournit normalement le provider
// global. Conséquence assumée : la lecture déclenchera des écritures dans
// `course_watch_logs` (même comportement que sur l'app user). C'est documenté
// dans le rapport T7.2 — la démo n'introduit aucun nouveau write path.
//
// Thème : DentalLearn dark (override du `bg-gray-100` du admin layout via
// `bg-[color:var(--color-bg)]` au niveau `<main>`, comme T3/T5/T6 POC).

import { useState } from 'react'

import EnrichedAudioPlayer, {
  type EnrichedPlayerTab,
} from '@/components/formation/EnrichedAudioPlayer'
import { AudioProvider, useAudio } from '@/context/AudioContext'

interface SequenceLite {
  id: string
  title: string
  formation_id: string | null
  course_media_url: string | null
  course_media_type: string | null
  course_duration_seconds: number | null
  learning_objectives: string[] | null
  timeline_url: string | null
  timeline_published: boolean
}

interface EnrichedPlayerPocClientProps {
  sequence: SequenceLite
  formationTitle: string | null
  coverImageUrl: string | null
}

export function EnrichedPlayerPocClient(props: EnrichedPlayerPocClientProps) {
  return (
    <AudioProvider>
      <PocPageBody {...props} />
    </AudioProvider>
  )
}

function PocPageBody({
  sequence,
  formationTitle,
  coverImageUrl,
}: EnrichedPlayerPocClientProps) {
  const [activeTab, setActiveTab] = useState<EnrichedPlayerTab>('combined')

  const audioSrc = sequence.course_media_url
  const isAudio = sequence.course_media_type === 'audio'

  return (
    <main className="min-h-screen bg-[color:var(--color-bg)] p-6 text-[color:var(--color-text-primary)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <DemoHeader
          sequence={sequence}
          formationTitle={formationTitle}
        />

        {!isAudio || !audioSrc ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
            Cette séquence n'a pas de média audio (
            <code>course_media_type !== 'audio'</code> ou{' '}
            <code>course_media_url</code> vide). T7.2 cible uniquement
            l'audio.
          </p>
        ) : (
          <>
            <TabSelector active={activeTab} onChange={setActiveTab} />

            <EnrichedAudioPlayer
              src={audioSrc}
              duration={sequence.course_duration_seconds ?? 0}
              sequenceId={sequence.id}
              sequenceTitle={sequence.title}
              formationTitle={formationTitle ?? ''}
              learningObjectives={sequence.learning_objectives}
              coverImageUrl={coverImageUrl}
              onComplete={() => {
                // Démo : pas d'écriture additionnelle, l'AudioContext gère
                // déjà course_watch_logs.
              }}
              onProgress={() => {
                // Démo : on n'a pas de course_progress à mettre à jour.
              }}
              timelineUrl={sequence.timeline_url}
              timelinePublished={sequence.timeline_published}
              activeTab={activeTab}
            />

            <DebugPanel sequence={sequence} src={audioSrc} />
          </>
        )}
      </div>
    </main>
  )
}

// ──────────────────────────────────────────────────────────────
// Sous-composants UI
// ──────────────────────────────────────────────────────────────

function DemoHeader({
  sequence,
  formationTitle,
}: {
  sequence: SequenceLite
  formationTitle: string | null
}) {
  return (
    <header className="space-y-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-bg-card)] p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-violet-500/30 px-2 py-0.5 font-semibold uppercase tracking-wider text-violet-100">
          POC-T7.2
        </span>
        <span className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-bg-input)] px-2 py-0.5 text-[color:var(--color-text-secondary)]">
          super_admin only
        </span>
        <span
          className={`rounded-full px-2 py-0.5 font-semibold ${
            sequence.timeline_published
              ? 'bg-emerald-500/30 text-emerald-100'
              : 'bg-amber-500/30 text-amber-100'
          }`}
        >
          timeline_published = {String(sequence.timeline_published)}
        </span>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--color-text-primary)]">
          {sequence.title}
        </h1>
        {formationTitle && (
          <p className="text-sm text-[color:var(--color-text-secondary)]">
            {formationTitle}
          </p>
        )}
      </div>
      <p className="text-xs text-[color:var(--color-text-secondary)]">
        Sequence ID :{' '}
        <code className="break-all text-[color:var(--color-text-primary)]">
          {sequence.id}
        </code>
      </p>
    </header>
  )
}

function TabSelector({
  active,
  onChange,
}: {
  active: EnrichedPlayerTab
  onChange: (tab: EnrichedPlayerTab) => void
}) {
  const tabs: { id: EnrichedPlayerTab; label: string; hint: string }[] = [
    { id: 'combined', label: 'Combiné', hint: 'Karaoké + Whiteboard' },
    { id: 'whiteboard', label: 'Whiteboard', hint: 'Visuels seuls' },
    { id: 'audio_only', label: 'Audio seul', hint: 'Player nu (pas d\'enrichissement)' },
  ]
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            active === t.id
              ? 'bg-ds-turquoise text-[#0F0F0F]'
              : 'border border-[color:var(--color-border)] bg-[color:var(--color-bg-card)] text-[color:var(--color-text-primary)] hover:border-ds-turquoise/50 hover:bg-[color:var(--color-bg-card-hover)]'
          }`}
          title={t.hint}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function DebugPanel({
  sequence,
  src,
}: {
  sequence: SequenceLite
  src: string
}) {
  const { state } = useAudio()
  const [open, setOpen] = useState(false)

  const isCurrentTrack = state.audioUrl === src

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-bg-input)] p-4 text-sm text-[color:var(--color-text-primary)]"
    >
      <summary className="cursor-pointer select-none text-base font-semibold text-[color:var(--color-text-primary)]">
        Debug (admin)
      </summary>
      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 md:grid-cols-2">
        <DebugRow
          label="state.currentTime"
          value={`${state.currentTime.toFixed(2)} s`}
        />
        <DebugRow
          label="state.duration"
          value={`${state.duration.toFixed(2)} s`}
        />
        <DebugRow
          label="state.isPlaying"
          value={String(state.isPlaying)}
        />
        <DebugRow
          label="isCurrentTrack (Q7.7)"
          value={String(isCurrentTrack)}
        />
        <DebugRow
          label="timeline_url"
          value={sequence.timeline_url ?? 'null'}
        />
        <DebugRow
          label="timeline_published (Q7.4)"
          value={String(sequence.timeline_published)}
        />
        <DebugRow
          label="state.audioUrl"
          value={state.audioUrl || '(empty)'}
        />
        <DebugRow label="src (props)" value={src} />
      </dl>
      <p className="mt-3 text-xs text-[color:var(--color-text-secondary)]">
        Cet onglet n'a pas vocation à être expédié en T7.3 — c'est un outil
        de validation visuelle pour la recette T7.2.
      </p>
    </details>
  )
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2 border-b border-[color:var(--color-border-light)] py-1 last:border-b-0">
      <dt className="text-[color:var(--color-text-secondary)]">{label}</dt>
      <dd className="break-all font-mono text-[color:var(--color-text-primary)]">
        {value}
      </dd>
    </div>
  )
}
