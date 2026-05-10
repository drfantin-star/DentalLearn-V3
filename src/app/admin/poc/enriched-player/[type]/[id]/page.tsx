// POC-T7.2 — Page démo Server Component.
// Charge la séquence (+ formation parente pour cover/title) côté serveur, gate
// super_admin, puis délègue le rendu interactif au Client Component.
//
// V1 : seul `params.type === 'formation'` est supporté. La forme `news`
// arrivera en T8 pour <NewsVisualSequence>.

import { notFound, redirect } from 'next/navigation'

import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

import { EnrichedPlayerPocClient } from './EnrichedPlayerPocClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { type: string; id: string }
}

export default async function EnrichedPlayerPocPage({ params }: PageProps) {
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

  if (params.type !== 'formation') {
    // Réservé à T8 (news visual sequence).
    notFound()
  }

  const admin = createAdminClient()

  const { data: sequence, error } = await admin
    .from('sequences')
    .select(
      'id, title, formation_id, course_media_url, course_media_type, course_duration_seconds, learning_objectives, timeline_url, timeline_published, updated_at'
    )
    .eq('id', params.id)
    .single()

  if (error || !sequence) {
    notFound()
  }

  // Cover image et titre formation viennent du parent (la table `sequences`
  // n'a pas de cover_image_url).
  let formationTitle: string | null = null
  let coverImageUrl: string | null = null
  if (sequence.formation_id) {
    const { data: formation } = await admin
      .from('formations')
      .select('title, cover_image_url, category')
      .eq('id', sequence.formation_id)
      .single()
    formationTitle = formation?.title ?? null
    coverImageUrl = formation?.cover_image_url ?? null
  }

  return (
    <EnrichedPlayerPocClient
      sequence={{
        id: sequence.id,
        title: sequence.title,
        formation_id: sequence.formation_id,
        course_media_url: sequence.course_media_url,
        course_media_type: sequence.course_media_type,
        course_duration_seconds: sequence.course_duration_seconds,
        learning_objectives: sequence.learning_objectives,
        timeline_url: sequence.timeline_url,
        timeline_published: sequence.timeline_published,
      }}
      formationTitle={formationTitle}
      coverImageUrl={coverImageUrl}
    />
  )
}
