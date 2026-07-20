import Link from 'next/link'
import { History } from 'lucide-react'
import {
  getCurrentCsMemberId,
  getMyValidations,
  contentTypeLabel,
  formatDateFr,
} from '@/lib/cs/data'

export const dynamic = 'force-dynamic'

function StateBadge({
  isCurrent,
  isStale,
}: {
  isCurrent: boolean
  isStale: boolean
}) {
  if (!isCurrent)
    return (
      <span className="text-[11px] font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
        Non courante
      </span>
    )
  if (isStale)
    return (
      <span className="text-[11px] font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
        Périmée
      </span>
    )
  return (
    <span className="text-[11px] font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
      Courante
    </span>
  )
}

export default async function CsHistoriquePage() {
  const memberId = await getCurrentCsMemberId()
  const rows = memberId ? await getMyValidations(memberId) : []

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">Mes validations</h1>
        <p className="text-sm text-gray-600 mt-1">
          Contenus que vous avez validés, en principal ou en co-signature.
        </p>
      </header>

      {!memberId ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
          <p className="text-gray-900 font-semibold">
            Aucune fiche membre active
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Votre compte n&apos;est rattaché à aucune fiche du Comité
            Scientifique.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
          <div className="inline-flex p-3 rounded-2xl bg-primary/10 mb-4">
            <History className="w-7 h-7 text-primary" />
          </div>
          <p className="text-gray-900 font-semibold">
            Aucune validation à votre actif
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Rendez-vous dans la file d&apos;attente pour valider un contenu.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-semibold">Type</th>
                <th className="px-5 py-3 font-semibold">Contenu</th>
                <th className="px-5 py-3 font-semibold">Rôle</th>
                <th className="px-5 py-3 font-semibold">Validé le</th>
                <th className="px-5 py-3 font-semibold">État</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60"
                >
                  <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                    {contentTypeLabel(r.content_type)}
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/cs/${r.content_type}/${r.content_id}`}
                      className="font-medium text-gray-900 hover:text-primary"
                    >
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                    {r.role === 'lead' ? 'Principal' : 'Co-signataire'}
                  </td>
                  <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                    {formatDateFr(r.validated_at)}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <StateBadge isCurrent={r.is_current} isStale={r.is_stale} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
