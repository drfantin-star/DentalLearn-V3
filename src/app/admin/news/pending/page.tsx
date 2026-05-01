'use client'

import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { QuestionsListPage } from '@/components/admin/news/QuestionsListPage'

export default function PendingPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <QuestionsListPage
        status="pending"
        title="Questions en attente d'approbation"
        subtitle="Sélectionnez les questions à intégrer au pool du quiz du jour"
        emptyMessage="Toutes les questions ont été traitées"
        emptyIcon="check"
      />
    </Suspense>
  )
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-[#2D1B96]" />
    </div>
  )
}
