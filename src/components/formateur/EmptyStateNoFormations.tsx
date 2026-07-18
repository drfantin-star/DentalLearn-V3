import { Inbox } from 'lucide-react'

export default function EmptyStateNoFormations() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6 min-h-[60vh]">
      <div className="bg-primary/10 p-6 rounded-full mb-6">
        <Inbox className="w-12 h-12 text-primary" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Aucune formation rattachée
      </h2>
      <p className="text-gray-600 max-w-md">
        Vous n&apos;êtes rattaché à aucune formation. Contactez Certily si
        c&apos;est une erreur.
      </p>
    </div>
  )
}
