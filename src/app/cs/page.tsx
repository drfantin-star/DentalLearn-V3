import Link from 'next/link'
import { ClipboardCheck, ArrowRight } from 'lucide-react'
import {
  getValidationQueue,
  contentTypeLabel,
  formatDateFr,
} from '@/lib/cs/data'

export const dynamic = 'force-dynamic'

export default async function CsQueuePage() {
  const queue = await getValidationQueue()

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">
          File d&apos;attente de validation
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Contenus publiés en attente d&apos;une première validation éditoriale
          du Comité Scientifique.
        </p>
      </header>

      {queue.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
          <div className="inline-flex p-3 rounded-2xl bg-primary/10 mb-4">
            <ClipboardCheck className="w-7 h-7 text-primary" />
          </div>
          <p className="text-gray-900 font-semibold">
            Aucun contenu en attente
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Tous les contenus publiés disposent d&apos;une validation courante.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">
            {queue.length} contenu{queue.length > 1 ? 's' : ''} à valider
          </p>
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            style={{ gridAutoRows: '1fr' }}
          >
            {queue.map((item) => (
              <Link
                key={`${item.content_type}:${item.content_id}`}
                href={`/cs/${item.content_type}/${item.content_id}`}
                className="group flex flex-col h-full rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-primary/40 hover:bg-primary/[0.02]"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-block text-[11px] font-semibold uppercase tracking-wide text-primary bg-primary/10 px-2 py-1 rounded-full">
                    {contentTypeLabel(item.content_type)}
                  </span>
                  <span className="text-[11px] font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                    En attente
                  </span>
                </div>

                <h2 className="text-base font-bold text-gray-900 leading-snug flex-1">
                  {item.title}
                </h2>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    Publié le {formatDateFr(item.published_at)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    Examiner
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
