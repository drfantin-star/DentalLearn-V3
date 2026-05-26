// ⚠️ Page POC admin — fondations whiteboard (POC-T4.1).
//    N'utilise PAS AudioContext : le `currentTime` est piloté par un slider
//    pour valider visuellement `getActiveScene` et les templates Grid +
//    Figures. L'intégration avec AudioContext (DPC anti-skip) viendra en T7.

import { redirect } from 'next/navigation'

import { isSuperAdmin } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'

import { WhiteboardTemplatesPOCClient } from './WhiteboardTemplatesPOCClient'

export const dynamic = 'force-dynamic'

export default async function WhiteboardTemplatesPOCPage() {
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

  return <WhiteboardTemplatesPOCClient />
}
