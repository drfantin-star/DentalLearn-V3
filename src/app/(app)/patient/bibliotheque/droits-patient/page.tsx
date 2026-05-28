import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { AXE_GRADIENTS } from '@/lib/constants/bibliotheque'

// Point d'entrée de la fiche interne « Vos droits en tant que patient ».
// Le contenu (Markdown / PDF) est fourni séparément par Julie et sera branché
// ultérieurement. Pour l'instant : header cohérent + placeholder.
export default function DroitsPatientPage() {
  const gradient = AXE_GRADIENTS[3]

  return (
    <>
      <header
        className="px-4 py-4"
        style={{
          background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
        }}
      >
        <div className="mb-1 flex items-center gap-3">
          <Link
            href="/patient/bibliotheque"
            aria-label="Retour à la bibliothèque"
            className="-ml-2 rounded-xl p-2 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ChevronLeft size={20} className="text-white" />
          </Link>
          <h1 className="text-2xl font-black text-white">Vos droits en tant que patient</h1>
        </div>
        <p className="mt-1 text-sm font-semibold leading-relaxed text-white/80">
          Fiche d'information à remettre systématiquement au patient
        </p>
      </header>

      <main
        className="mx-auto min-h-screen max-w-lg px-4 py-6 md:max-w-2xl md:px-6 lg:max-w-4xl lg:px-8 xl:max-w-6xl"
        style={{ background: '#0F0F0F' }}
      >
        <p className="rounded-2xl border border-gray-800 bg-[#1a1a1a] p-6 text-center text-sm text-gray-400">
          Le contenu de cette fiche sera disponible prochainement.
        </p>
      </main>
    </>
  )
}
