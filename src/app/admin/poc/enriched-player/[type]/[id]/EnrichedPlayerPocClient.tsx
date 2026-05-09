'use client'

// POC-T7.2 — Page démo Client Component.
//
// Monte un <AudioProvider> *local* à la page : les routes /admin/* ne sont
// pas wrappées par le `(app)/layout.tsx` qui fournit normalement le provider
// global. Conséquence assumée : la lecture déclenchera des écritures dans
// `course_watch_logs` (même comportement que sur l'app user). C'est documenté
// dans le rapport T7.2 — la démo n'introduit aucun nouveau write path.

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
    <main className="mx-auto max-w-5xl space-y-6 p-6 text-white">
      <DemoHeader
        sequence={sequence}
        formationTitle={formationTitle}
      />

      {!isAudio || !audioSrc ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
          Cette séquence n'a pas de média audio (
          <code>course_media_type !== 'audio'</code> ou{' '}
          <code>course_media_url</code> vide). T7.2 cible uniquement l'audio.
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
    <header className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-violet-500/20 px-2 py-0.5 font-medium uppercase tracking-wider text-violet-200">
          POC-T7.2
        </span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/70">
          super_admin only
        </span>
        <span
          className={`rounded-full px-2 py-0.5 font-medium ${
            sequence.timeline_published
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-amber-500/20 text-amber-200'
          }`}
        >
          timeline_published = {String(sequence.timeline_published)}
        </span>
      </div>
      <div>
        <h1 className="text-2xl font-bold">{sequence.title}</h1>
        {formationTitle && (
          <p className="text-sm text-white/60">{formationTitle}</p>
        )}
      </div>
      <p className="text-xs text-white/50">
        Sequence ID : <code className="break-all">{sequence.id}</code>
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
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            active === t.id
              ? 'bg-emerald-500 text-emerald-950'
              : 'bg-white/10 text-white/80 hover:bg-white/20'
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
      className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs text-white/70"
    >
      <summary className="cursor-pointer select-none text-sm font-medium text-white">
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
      <p className="mt-3 text-[11px] text-white/40">
        Cet onglet n'a pas vocation à être expédié en T7.3 — c'est un outil de
        validation visuelle pour la recette T7.2.
      </p>
    </details>
  )
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2 border-b border-white/5 py-1 last:border-b-0">
      <dt className="text-white/50">{label}</dt>
      <dd className="break-all font-mono text-white">{value}</dd>
    </div>
  )
}
