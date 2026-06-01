// Layout plein écran pour l'onboarding « centres d'intérêt ».
// La bottom nav et le chrome audio/PWA sont déjà neutralisés pour ce segment
// dans <AppShell> (cf. (app)/layout.tsx). Ce layout fournit simplement un
// conteneur centré sans navigation, pour un parcours focalisé.
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <main className="min-h-screen w-full">{children}</main>
}
