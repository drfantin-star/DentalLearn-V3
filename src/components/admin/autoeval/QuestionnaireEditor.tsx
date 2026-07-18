'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, AlertCircle, ClipboardList } from 'lucide-react'
import QuestionnaireHeaderForm from './QuestionnaireHeaderForm'
import BlockEditor from './BlockEditor'
import RoutingCardEditor from './RoutingCardEditor'
import type { AdminQuestionnaire } from '@/lib/autoeval/useAdminQuestionnaireDefinition'

interface Props {
  questionnaire: AdminQuestionnaire
  reload: () => void
}

type Notification = { kind: 'success' | 'error'; message: string }

export default function QuestionnaireEditor({ questionnaire, reload }: Props) {
  const [notif, setNotif] = useState<Notification | null>(null)

  const onSaved = useCallback(
    (message: string) => {
      setNotif({ kind: 'success', message })
      window.setTimeout(() => setNotif(null), 4000)
      reload()
    },
    [reload]
  )

  const onError = useCallback((message: string) => {
    setNotif({ kind: 'error', message })
    window.setTimeout(() => setNotif(null), 6000)
  }, [])

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* En-tête de page */}
      <div className="mb-6">
        <Link
          href="/admin/bibliotheque"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" /> Retour à la Bibliothèque
        </Link>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-pink-500/10 p-2">
            <ClipboardList className="h-6 w-6 text-pink-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{questionnaire.titre}</h1>
            <p className="text-sm text-gray-500">
              Éditeur du questionnaire · <span className="font-mono">{questionnaire.slug}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notif && (
        <div
          role="status"
          className={`mb-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
            notif.kind === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {notif.kind === 'success' ? (
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
          )}
          <span>{notif.message}</span>
        </div>
      )}

      <div className="space-y-6">
        {/* En-tête éditable */}
        <QuestionnaireHeaderForm
          questionnaire={questionnaire}
          onSaved={onSaved}
          onError={onError}
        />

        {/* Blocs */}
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
            Blocs ({questionnaire.blocks.length})
          </h2>
          <div className="space-y-3">
            {questionnaire.blocks.map((block) => (
              <BlockEditor key={block.id} block={block} onSaved={onSaved} onError={onError} />
            ))}
          </div>
        </div>

        {/* Cartes de routage */}
        {questionnaire.routing.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
              Cartes de routage ({questionnaire.routing.length})
            </h2>
            <div className="space-y-3">
              {questionnaire.routing.map((routing) => (
                <RoutingCardEditor
                  key={routing.id}
                  routing={routing}
                  onSaved={onSaved}
                  onError={onError}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
