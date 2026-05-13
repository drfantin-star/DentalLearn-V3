import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { SynthesisEditForm } from '@/components/admin/news/SynthesisEditForm'

// ============================================================================
// /admin/news/[id]/edit — POC-T12
//
// Server Component. Fetch :
//   1. synthèse complète (news_syntheses)
//   2. article brut lié (news_raw : DOI, journal, source, abstract)
//   3. display name de last_edited_by (user_profiles.first_name+last_name,
//      best-effort, fallback null si introuvable)
//
// Auth : isSuperAdmin() (invariant Q-T12-5). Redirect /admin/news si pas admin.
// Délégation rendering au Client Component <SynthesisEditForm>.
// ============================================================================

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditPage({ params }: PageProps) {
  const { id } = await params

  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }
  if (!(await isSuperAdmin(session.user.id))) {
    redirect('/admin/news')
  }

  const adminSupabase = createAdminClient()

  const { data: synthesis, error: synthError } = await adminSupabase
    .from('news_syntheses')
    .select('*')
    .eq('id', id)
    .single()

  if (synthError || !synthesis) {
    notFound()
  }

  let raw: {
    title: string
    url: string | null
    doi: string | null
    journal: string | null
    published_at: string | null
    abstract: string | null
  } | null = null

  if (synthesis.raw_id) {
    const { data: rawData } = await adminSupabase
      .from('news_raw')
      .select('title, url, doi, journal, published_at, abstract')
      .eq('id', synthesis.raw_id)
      .maybeSingle()
    raw = rawData ?? null
  }

  // Display name de last_edited_by (best-effort)
  let lastEditedByName: string | null = null
  if (synthesis.last_edited_by) {
    const { data: profile } = await adminSupabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('id', synthesis.last_edited_by)
      .maybeSingle()
    if (profile) {
      const composed = [profile.first_name, profile.last_name]
        .filter((v) => typeof v === 'string' && v.length > 0)
        .join(' ')
        .trim()
      lastEditedByName = composed || null
    }
  }

  return (
    <SynthesisEditForm
      synthesis={synthesis}
      raw={raw}
      lastEditedByName={lastEditedByName}
    />
  )
}
