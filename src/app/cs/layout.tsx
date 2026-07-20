import { requireCsMemberOrRedirect } from '@/lib/auth/guards'
import CsShell from '@/components/cs/CsShell'
import DesktopOnly from '@/components/layout/DesktopOnly'

export const dynamic = 'force-dynamic'

export default async function CsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Gate Server Component : /login si non connecté, /403 si ni cs_member ni
  // super_admin (Dr Fantin reste autorisée).
  await requireCsMemberOrRedirect('/cs')

  return (
    <DesktopOnly title="L'espace Comité Scientifique" variant="espace">
      <CsShell>{children}</CsShell>
    </DesktopOnly>
  )
}
