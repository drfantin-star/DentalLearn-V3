// ⚠️ Page POC admin — utilise un <audio> HTML natif et NON AudioContext.
//    L'intégration propre avec AudioContext (anti-skip DPC, course_watch_logs)
//    arrivera en T7. Cette page existe uniquement pour valider le rendu visuel
//    du karaoké sur les données du pilote (Communication et Écoute Active S2).

import { redirect } from 'next/navigation'

import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

import { KaraokePOCClient } from './KaraokePOCClient'

export const dynamic = 'force-dynamic'

const POC_AUDIO_URL =
  'https://dxybsuhfkwuemapqrvgz.supabase.co/storage/v1/object/public/formations/communication-ecoute-active/audio/sequence_02_non_verbale-1778057695.mp3'
const POC_SEQUENCE_ID = 'e8dfa6b8-ef34-4454-a198-e6f973f466de'

export default async function KaraokePOCPage() {
  const supabase = createClient()
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
  const { data: sequence, error } = await admin
    .from('sequences')
    .select('id, title, timeline_url, timeline_published')
    .eq('id', POC_SEQUENCE_ID)
    .single()

  if (error || !sequence) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="mb-4 text-2xl font-bold text-white">
          POC Karaoké — Erreur
        </h1>
        <p className="text-sm text-[color:var(--color-text-muted)]">
          Impossible de charger la séquence pilote (
          <code>{POC_SEQUENCE_ID}</code>
          ){error ? ` : ${error.message}` : '.'}
        </p>
      </main>
    )
  }

  return (
    <KaraokePOCClient
      sequenceTitle={sequence.title}
      timelineUrl={sequence.timeline_url}
      audioUrl={POC_AUDIO_URL}
    />
  )
}
