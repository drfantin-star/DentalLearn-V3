import BibliothequeView from '@/components/bibliotheque/BibliothequeView'
import { getRessourcesByAxe } from '@/lib/bibliotheque/queries'

export const dynamic = 'force-dynamic'

export default async function FormationBibliothequePage() {
  const ressources = await getRessourcesByAxe(1)
  return (
    <BibliothequeView axe={1} ressources={ressources} backHref="/formation" />
  )
}
