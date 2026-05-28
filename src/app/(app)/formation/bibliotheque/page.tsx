import BibliothequeView from '@/components/bibliotheque/BibliothequeView'
import { BIBLIOTHEQUE_FORMATION } from '@/lib/constants/bibliotheque'

export default function FormationBibliothequePage() {
  return (
    <BibliothequeView axe={1} ressources={BIBLIOTHEQUE_FORMATION} backHref="/formation" />
  )
}
