import { redirect } from 'next/navigation'

import { isSuperAdmin } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'

import { AudioJobsClient } from './AudioJobsClient'

export const dynamic = 'force-dynamic'

export default async function AudioJobsPage() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }
  if (!(await isSuperAdmin(session.user.id))) {
    redirect('/admin')
  }

  return <AudioJobsClient />
}
