import { requireFormateurOrRedirect } from '@/lib/auth/guards'
import FormateurShell from '@/components/formateur/FormateurShell'
import DesktopOnly from '@/components/layout/DesktopOnly'

export const dynamic = 'force-dynamic'

export default async function FormateurLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Sprint 2 — Gate Server Component : redirect /login si non connecté,
  // /403 si ni formateur ni super_admin (Dr Fantin reste autorisée).
  await requireFormateurOrRedirect('/formateur/dashboard')

  return (
    <DesktopOnly title="Espace Formateur" variant="espace">
      <FormateurShell>{children}</FormateurShell>
    </DesktopOnly>
  )
}
