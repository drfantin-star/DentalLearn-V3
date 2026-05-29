import BibliothequeView from '@/components/bibliotheque/BibliothequeView'
import { getRessourcesByAxe } from '@/lib/bibliotheque/queries'

export const dynamic = 'force-dynamic'

export default async function SanteBibliothequePage() {
  const ressources = await getRessourcesByAxe(4)
  return (
    <BibliothequeView axe={4} ressources={ressources} backHref="/sante" />
  )
}
