import { Clock } from 'lucide-react'
import { Card } from '@/components/ui/Card'

interface ComingSoonStubProps {
  title: string
  ticketRef: string
}

/**
 * Sprint 2 T2 — Placeholder commun aux 4 pages /formateur/*.
 * Sera remplacé par le vrai contenu en T3 (dashboard), T4 (agenda),
 * T5 (masterclass), T6 (profil).
 */
export default function ComingSoonStub({ title, ticketRef }: ComingSoonStubProps) {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{title}</h1>

      <Card className="p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#2D1B96]/10 flex items-center justify-center">
          <Clock className="w-8 h-8 text-[#2D1B96]" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Bientôt disponible</h2>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          Cette page sera activée à la prochaine livraison.
        </p>
        <p className="text-xs text-gray-400 font-mono">{ticketRef}</p>
      </Card>
    </div>
  )
}
