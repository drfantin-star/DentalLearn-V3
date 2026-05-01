'use client'

import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { QuestionsListPage } from '@/components/admin/news/QuestionsListPage'

export default function ApprovedPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <QuestionsListPage
        status="approved"
        title="Questions approuvées pour le quiz du jour"
        subtitle="Questions actuellement éligibles au tirage aléatoire quotidien"
        emptyMessage="Aucune question approuvée pour le moment"
        emptyIcon="inbox"
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
