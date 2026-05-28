import BibliothequeView from '@/components/bibliotheque/BibliothequeView'
import { BIBLIOTHEQUE_PATIENT } from '@/lib/constants/bibliotheque'

export default function PatientBibliothequePage() {
  return (
    <BibliothequeView axe={3} ressources={BIBLIOTHEQUE_PATIENT} backHref="/patient" />
  )
}
