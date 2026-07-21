import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CheckCircle2, AlertTriangle, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  getContentPreview,
  getValidationStatus,
  getCurrentCsMemberId,
  isCsContentType,
  contentTypeLabel,
  formatDateFr,
} from '@/lib/cs/data'
import ValidateActions from '@/components/cs/ValidateActions'

export const dynamic = 'force-dynamic'

export default async function CsValidationPage({
  params,
}: {
  params: Promise<{ content_type: string; content_id: string }>
}) {
  const { content_type, content_id } = await params

  if (!isCsContentType(content_type)) notFound()

  const [preview, status, memberId] = await Promise.all([
    getContentPreview(content_type, content_id),
    getValidationStatus(content_type, content_id),
    getCurrentCsMemberId(),
  ])

  if (!preview) notFound()

  // Le membre courant est-il déjà le validateur lead de la validation
  // courante ? (get_validation_status ne renvoie pas l'id membre du lead.)
  let amLead = false
  if (status.validated && status.validation_id) {
    const supabase = await createClient()
    const { data: cur } = await supabase
      .from('editorial_validations')
      .select('validated_by_lead')
      .eq('id', status.validation_id)
      .maybeSingle()
    amLead = (cur?.validated_by_lead as string | undefined) === memberId
  }

  const hasSecondary = status.secondary_name != null
  const mode: 'primary' | 'cosign' | 'readonly' = !status.validated
    ? 'primary'
    : !hasSecondary && !amLead
      ? 'cosign'
      : 'readonly'

  return (
    <div>
      <Link
        href="/cs"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        File d&apos;attente
      </Link>

      <header className="mb-6">
        <span className="inline-block text-[11px] font-semibold uppercase tracking-wide text-primary bg-primary/10 px-2 py-1 rounded-full">
          {contentTypeLabel(preview.content_type)}
        </span>
        <h1 className="text-2xl font-black text-gray-900 mt-2">
          {preview.title}
        </h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contenu à valider — lecture seule */}
        <section className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">
            <FileText className="w-4 h-4" />
            Contenu soumis à validation
          </h2>

          {preview.meta.length > 0 && (
            <ul className="space-y-1 mb-4">
              {preview.meta.map((m) => (
                <li key={m} className="text-sm text-gray-700">
                  {m}
                </li>
              ))}
            </ul>
          )}

          {preview.sections.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                Séquences
              </p>
              <ol className="space-y-1 border-l-2 border-gray-100 pl-4">
                {preview.sections.map((s) => (
                  <li key={s} className="text-sm text-gray-700">
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {preview.fields && preview.fields.length > 0 && (
            <div className="space-y-4 mb-4">
              {preview.fields.map((f) => (
                <div key={f.label}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
                    {f.label}
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">
                    {f.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
              Empreinte cryptographique du contenu
            </p>
            <p className="font-mono text-[11px] text-gray-500 break-all">
              {preview.content_hash ?? '(indisponible)'}
            </p>
          </div>
        </section>

        {/* Colonne action / statut */}
        <aside className="space-y-4">
          {status.validated && (
            <div
              className={`rounded-2xl border p-5 ${
                status.is_stale
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-emerald-200 bg-emerald-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                {status.is_stale ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                )}
                <span className="font-semibold text-gray-900">
                  {status.is_stale ? 'Validation périmée' : 'Contenu validé'}
                </span>
              </div>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-gray-500">Validateur principal</dt>
                  <dd className="text-gray-900 font-medium">
                    {status.lead_name ?? '—'}
                    {status.lead_title ? (
                      <span className="text-gray-500 font-normal">
                        {' '}
                        · {status.lead_title}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Second validateur</dt>
                  <dd className="text-gray-900 font-medium">
                    {status.secondary_name ?? 'Non co-signé'}
                    {status.secondary_title ? (
                      <span className="text-gray-500 font-normal">
                        {' '}
                        · {status.secondary_title}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Validé le</dt>
                  <dd className="text-gray-900 font-medium">
                    {formatDateFr(status.validated_at)}
                  </dd>
                </div>
              </dl>
              {status.is_stale && (
                <p className="text-xs text-amber-700 mt-3">
                  Le contenu a été modifié depuis la validation. Une
                  ré-validation relève de l&apos;administration
                  (révocation puis nouvelle validation).
                </p>
              )}
            </div>
          )}

          <ValidateActions
            mode={mode}
            contentType={preview.content_type}
            contentId={content_id}
            memberId={memberId}
            validationId={status.validation_id}
            leadName={status.lead_name}
            amLead={amLead}
          />
        </aside>
      </div>
    </div>
  )
}
