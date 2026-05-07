'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { StructuredWhiteboard } from '@/components/audio-enriched/StructuredWhiteboard'
import { Comparison } from '@/components/audio-enriched/templates/Comparison'
import { Figures } from '@/components/audio-enriched/templates/Figures'
import { Flowchart } from '@/components/audio-enriched/templates/Flowchart'
import { Grid } from '@/components/audio-enriched/templates/Grid'
import { getActiveScene } from '@/lib/timeline/getActiveScene'
import { MOCK_WHITEBOARD_TIMELINE } from '@/lib/timeline/mocks/whiteboard-scenes.mock'

/**
 * Page POC client — section 1 pilote `<StructuredWhiteboard>` via slider,
 * section 2 affiche les templates en isolation avec données mockées dédiées.
 */

const QUICK_JUMPS = [0, 5, 18, 35, 55, 75, 92] as const

const ISOLATED_GRID_CARDS = [
  { text: 'Endodontie', subtitle: 'Pulpe vivante' },
  { text: 'Restauratrice', subtitle: 'Reconstruction' },
  { text: 'Prothèse', subtitle: 'CFAO', variant: 'highlight' as const },
  { text: 'Parodontologie', subtitle: 'Tissus de soutien' },
]

const ISOLATED_FIGURES = [
  { value: '67%', label: 'réduction du risque', emphasis: true },
  { value: 'n=412', label: 'patients étudiés' },
  { value: '5 ans', label: 'suivi moyen' },
]

const FLOWCHART_DEMO = [
  { text: 'Diagnostic', subtitle: 'Étape 1' },
  { text: 'Imagerie', subtitle: 'Étape 2' },
  { text: 'Traitement', subtitle: 'Étape 3', variant: 'highlight' as const },
]

const COMPARISON_DEMO = {
  left: {
    title: 'Option A',
    cards: [
      { text: 'Avantage 1' },
      { text: 'Avantage 2', variant: 'success' as const },
    ],
  },
  right: {
    title: 'Option B',
    cards: [{ text: 'Risque connu', variant: 'warning' as const }],
  },
}

const PLACEHOLDER_TEMPLATES: Array<{
  kind: 'causal' | 'timeline'
  ticket: string
}> = [
  { kind: 'causal', ticket: 'T4.3' },
  { kind: 'timeline', ticket: 'T4.2' },
]

export function WhiteboardTemplatesPOCClient() {
  const [currentTime, setCurrentTime] = useState<number>(0)

  const activeScene = useMemo(
    () => getActiveScene(currentTime, MOCK_WHITEBOARD_TIMELINE.scenes),
    [currentTime]
  )

  return (
    <main className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text-primary)] p-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 space-y-2">
          <p className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">
            POC Whiteboard · Admin · T4.2
          </p>
          <h1 className="text-2xl font-bold text-white">
            Whiteboard templates POC
          </h1>
          <p className="text-sm text-[color:var(--color-text-secondary)]">
            T4.1 : Grid + Figures. T4.2 (en cours) : Flowchart + Comparison
            câblés ; Timeline en placeholder jusqu'à la fin du ticket. Causal
            reste en placeholder T4.3.
          </p>
          <div className="text-xs">
            <Link
              href="/admin/poc/karaoke"
              className="text-ds-turquoise hover:underline"
            >
              ← Retour au POC Karaoké
            </Link>
          </div>
        </header>

        {/* ─── Section 1 — Timeline complète via slider ─────────────────── */}
        <section className="mb-6 rounded-xl bg-[color:var(--color-bg-card)]/40 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">
            1. Timeline complète (test <code>getActiveScene</code>)
          </h2>
          <p className="mb-4 text-xs text-[color:var(--color-text-muted)]">
            Bouge le slider pour traverser les 6 scènes mockées. Les gaps
            entre scènes (12-15s, 27-30s, etc.) doivent afficher le
            placeholder « Visualisation suivante à venir… ».
          </p>

          <div className="mb-4">
            <input
              type="range"
              min={0}
              max={100}
              step={0.5}
              value={currentTime}
              onChange={(e) => setCurrentTime(Number(e.target.value))}
              className="w-full accent-ds-turquoise"
              aria-label="Position dans la timeline mockée"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-text-secondary)]">
              <span className="font-mono">
                {currentTime.toFixed(1)}s
              </span>
              <span>·</span>
              <span>
                scène active :{' '}
                <span className="text-[color:var(--color-text-primary)]">
                  {activeScene?.title ?? '— aucune —'}
                </span>
              </span>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {QUICK_JUMPS.map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setCurrentTime(sec)}
                className="rounded-md border border-white/10 bg-[color:var(--color-bg-card)] px-3 py-1 text-xs text-[color:var(--color-text-primary)] hover:border-ds-turquoise/40 hover:text-ds-turquoise"
              >
                {sec}s
              </button>
            ))}
          </div>

          <div className="min-h-[320px]">
            <StructuredWhiteboard
              scenes={MOCK_WHITEBOARD_TIMELINE.scenes}
              currentTime={currentTime}
            />
          </div>
        </section>

        {/* ─── Section 2 — Galerie isolée ────────────────────────────────── */}
        <section className="rounded-xl bg-[color:var(--color-bg-card)]/40 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">
            2. Galerie isolée (templates hors contexte timeline)
          </h2>
          <p className="mb-6 text-xs text-[color:var(--color-text-muted)]">
            Chaque card render le template avec des données simples. Les
            templates non livrés en T4.1 affichent un placeholder explicite.
          </p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <GalleryCard
              title="Grid · 4 colonnes · highlight"
              code={JSON.stringify(
                { columns: 4, cards: ISOLATED_GRID_CARDS },
                null,
                2
              )}
            >
              <Grid columns={4} cards={ISOLATED_GRID_CARDS} />
            </GalleryCard>

            <GalleryCard
              title="Figures · 3 chiffres · emphasis"
              code={JSON.stringify({ figures: ISOLATED_FIGURES }, null, 2)}
            >
              <Figures figures={ISOLATED_FIGURES} />
            </GalleryCard>

            <GalleryCard
              title="Flowchart · 3 étapes · highlight"
              code={JSON.stringify({ cards: FLOWCHART_DEMO }, null, 2)}
            >
              <Flowchart cards={FLOWCHART_DEMO} />
            </GalleryCard>

            <GalleryCard
              title="Comparison · 2 colonnes · success/warning"
              code={JSON.stringify(COMPARISON_DEMO, null, 2)}
            >
              <Comparison
                left={COMPARISON_DEMO.left}
                right={COMPARISON_DEMO.right}
              />
            </GalleryCard>

            {PLACEHOLDER_TEMPLATES.map(({ kind, ticket }) => (
              <GalleryCard
                key={kind}
                title={`${kind} · à livrer dans ${ticket}`}
                code=""
              >
                <div className="rounded-lg border border-dashed border-white/20 bg-[color:var(--color-bg-card)] p-6 text-center text-sm text-[color:var(--color-text-muted)]">
                  Template <code className="text-ds-turquoise">{kind}</code>{' '}
                  — à livrer dans {ticket}
                </div>
              </GalleryCard>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

function GalleryCard({
  title,
  code,
  children,
}: {
  title: string
  code: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-[color:var(--color-bg-card)]/60 p-4">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="rounded-md bg-[color:var(--color-bg)]/60 p-4">
        {children}
      </div>
      {code && (
        <pre className="overflow-x-auto rounded-md bg-[color:var(--color-bg)] p-3 text-[11px] leading-snug text-[color:var(--color-text-secondary)]">
          {code}
        </pre>
      )}
    </div>
  )
}
