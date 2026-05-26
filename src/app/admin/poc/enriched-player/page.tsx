// POC-T7.2 — Index des séquences avec timeline enrichie.
// Liste les séquences dont `timeline_url IS NOT NULL`, triées par
// `updated_at DESC`. Lien vers la page démo `<EnrichedAudioPlayer>`.
//
// Auth : super_admin only (cf. /src/app/admin/poc/karaoke/page.tsx).
// Thème : DentalLearn dark (override du `bg-gray-100` du admin layout via
// `bg-[color:var(--color-bg)]` au niveau `<main>`, comme T3/T5/T6 POC).

import Link from 'next/link'
import { redirect } from 'next/navigation'

import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface SequenceRow {
  id: string
  title: string
  formation_id: string | null
  course_media_type: string | null
  timeline_url: string | null
  timeline_published: boolean
  updated_at: string | null
}

export default async function EnrichedPlayerPocIndexPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }
  if (!(await isSuperAdmin(session.user.id))) {
    redirect('/')
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sequences')
    .select(
      'id, title, formation_id, course_media_type, timeline_url, timeline_published, updated_at'
    )
    .not('timeline_url', 'is', null)
    .order('updated_at', { ascending: false })

  const sequences = (data ?? []) as SequenceRow[]

  return (
    <main className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text-primary)] p-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 space-y-2">
          <p className="text-xs uppercase tracking-wider text-[color:var(--color-text-secondary)]">
            POC-T7.2 · Admin · super_admin only
          </p>
          <h1 className="text-2xl font-bold text-[color:var(--color-text-primary)]">
            Démo{' '}
            <code className="rounded bg-[color:var(--color-bg-card)] px-2 py-0.5 text-base text-ds-turquoise">
              {'<EnrichedAudioPlayer>'}
            </code>
          </h1>
          <p className="text-sm text-[color:var(--color-text-secondary)]">
            Page démo isolée pour valider visuellement l'intégration karaoké +
            whiteboard structuré au-dessus de l'<code>AudioContext</code>{' '}
            existant. Lecture seule sur le contexte audio (anti-skip DPC
            conservé).
          </p>
        </header>

        {error && (
          <p className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            Erreur de chargement des séquences : {error.message}
          </p>
        )}

        {!error && sequences.length === 0 && (
          <p className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg-card)] p-4 text-sm text-[color:var(--color-text-secondary)]">
            Aucune séquence avec <code>timeline_url</code> défini en base.
            Lance d'abord le pipeline T2 ou enregistre une URL via{' '}
            <Link
              href="/admin/timelines"
              className="text-ds-turquoise hover:underline"
            >
              /admin/timelines
            </Link>
            .
          </p>
        )}

        <ul className="space-y-2">
          {sequences.map((seq) => (
            <li
              key={seq.id}
              className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg-card)] p-4 transition-colors hover:bg-[color:var(--color-bg-card-hover)]"
            >
              <Link
                href={`/admin/poc/enriched-player/formation/${seq.id}`}
                className="block"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-[color:var(--color-text-primary)]">
                      {seq.title}
                    </p>
                    <p className="text-xs text-[color:var(--color-text-secondary)]">
                      <code>{seq.id}</code>
                      {seq.course_media_type && (
                        <>
                          {' · '}
                          <span>{seq.course_media_type}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      seq.timeline_published
                        ? 'bg-emerald-500/20 text-emerald-200'
                        : 'bg-amber-500/20 text-amber-100'
                    }`}
                  >
                    {seq.timeline_published ? 'published' : 'draft'}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <footer className="mt-8 text-xs text-[color:var(--color-text-secondary)]">
          <p>
            T7.2 ne touche ni à <code>AudioContext.tsx</code>, ni à{' '}
            <code>AudioPlayer.tsx</code>, ni à{' '}
            <code>SequencePlayer.tsx</code>. Voir{' '}
            <code>RAPPORT_T7_2_DEMO_ENRICHED_PLAYER.md</code>.
          </p>
        </footer>
      </div>
    </main>
  )
}
