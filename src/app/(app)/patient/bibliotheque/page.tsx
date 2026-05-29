import BibliothequeView from '@/components/bibliotheque/BibliothequeView'
import { getRessourcesByAxe } from '@/lib/bibliotheque/queries'

export const dynamic = 'force-dynamic'

export default async function PatientBibliothequePage() {
  const ressources = await getRessourcesByAxe(3)
  return (
    <BibliothequeView
      axe={3}
      ressources={ressources}
      backHref="/patient"
      showActionFAttestation
    />
  )
}
