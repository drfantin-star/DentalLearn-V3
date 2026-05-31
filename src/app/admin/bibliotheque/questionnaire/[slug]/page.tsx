'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { useAdminQuestionnaireDefinition } from '@/lib/autoeval/useAdminQuestionnaireDefinition'
import QuestionnaireEditor from '@/components/admin/autoeval/QuestionnaireEditor'

export default function AdminQuestionnaireEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const { questionnaire, loading, error, reload } = useAdminQuestionnaireDefinition(slug)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !questionnaire) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Link
          href="/admin/bibliotheque"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" /> Retour à la Bibliothèque
        </Link>
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Questionnaire introuvable : {error ?? slug}</span>
        </div>
      </div>
    )
  }

  return <QuestionnaireEditor questionnaire={questionnaire} reload={reload} />
}
