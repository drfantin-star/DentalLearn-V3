'use client'

import { ChevronLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import AutoEvalFlow from '@/components/autoeval/AutoEvalFlow'

export default function AutoEvaluationPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0F0F0F' }}>
      <header className="bg-gradient-to-br from-[#EC4899] to-[#A78BFA] px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/sante')}
            className="-ml-2 rounded-xl p-2 transition-colors hover:bg-white/20"
            aria-label="Retour"
          >
            <ChevronLeft size={20} className="text-white" />
          </button>
          <h1 className="text-xl font-black text-white">Auto-évaluation santé</h1>
        </div>
      </header>

      <AutoEvalFlow />
    </div>
  )
}
