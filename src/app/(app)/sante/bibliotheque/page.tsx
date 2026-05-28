import BibliothequeView from '@/components/bibliotheque/BibliothequeView'
import { BIBLIOTHEQUE_SANTE } from '@/lib/constants/bibliotheque'

export default function SanteBibliothequePage() {
  return (
    <BibliothequeView axe={4} ressources={BIBLIOTHEQUE_SANTE} backHref="/sante" />
  )
}
