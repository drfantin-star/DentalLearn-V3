import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserOrg, getUserIntraRole } from '@/lib/auth/rbac'
import type { IntraRole, OrgType } from '@/lib/auth/rbac'
import TenantShell from '@/components/tenant/TenantShell'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES: ReadonlySet<IntraRole> = new Set<IntraRole>([
  'titulaire',
  'admin_rh',
  'admin_of',
])

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const userOrg = await getUserOrg(user.id)
  if (!userOrg) {
    redirect('/')
  }

  const intraRole = await getUserIntraRole(user.id)
  if (!intraRole || !ALLOWED_ROLES.has(intraRole)) {
    redirect('/403')
  }

  // Charger les colonnes branding (non incluses dans UserOrg)
  const adminSupabase = createAdminClient()
  const { data: orgFull } = await adminSupabase
    .from('organizations')
    .select('id, name, type, plan, branding_logo_url, branding_primary_color')
    .eq('id', userOrg.id)
    .single()

  const org = orgFull ?? {
    id: userOrg.id,
    name: userOrg.name,
    type: userOrg.type as OrgType,
    plan: userOrg.plan,
    branding_logo_url: null,
    branding_primary_color: null,
  }

  return <TenantShell org={org}>{children}</TenantShell>
}
