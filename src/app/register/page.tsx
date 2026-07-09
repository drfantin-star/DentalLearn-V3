import RegisterForm from '@/components/auth/RegisterForm'
import WaitlistForm from '@/components/auth/WaitlistForm'

// Server Component : la decision waitlist vs inscription se fait cote serveur.
// Le code d invitation (REGISTER_INVITE_CODE) n est jamais expose au bundle
// client — il reste dans l environnement serveur, on ne compare ici que la
// valeur recue via l URL. Rendu dynamique force (pas de cache statique) car la
// sortie depend d un query param.
export const dynamic = 'force-dynamic'

type SearchParams = { [key: string]: string | string[] | undefined }

function isInviteValid(inviteParam: string | string[] | undefined): boolean {
  const expected = process.env.REGISTER_INVITE_CODE
  // Pas de code configure cote serveur => porte fermee : personne ne peut
  // passer la waitlist. Evite qu une variable absente ouvre l inscription.
  if (!expected) return false

  const provided = Array.isArray(inviteParam) ? inviteParam[0] : inviteParam
  if (!provided) return false

  return provided === expected
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams

  // La porte s'ouvre en grand si les inscriptions publiques sont ouvertes
  // (NEXT_PUBLIC_REGISTRATION_OPEN=true, meme flag que la page login) OU si un
  // code d'invitation valide est fourni. Sinon : waitlist. Flag absent/!= true
  // + pas d'invite => comportement beta actuel inchange.
  const registrationOpen = process.env.NEXT_PUBLIC_REGISTRATION_OPEN === 'true'

  if (registrationOpen || isInviteValid(params.invite)) {
    return <RegisterForm />
  }

  return <WaitlistForm />
}
