'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import {
  useFormationBySlug,
  useUserFormationProgress,
  getCategoryConfig,
  type Sequence,
} from '@/lib/supabase'
import FormationDetail from '@/components/formation/FormationDetail'
import SequencePlayer from '@/components/formation/SequencePlayer'

export default function FormationSlugPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const { formation, loading, error } = useFormationBySlug(params.slug)

  const [selectedSequence, setSelectedSequence] = useState<Sequence | null>(null)
  const [sequenceGradient, setSequenceGradient] = useState<{ from: string; to: string }>({ from: '#8B5CF6', to: '#A78BFA' })

  const { markCompleted } = useUserFormationProgress(formation?.id ?? null)

  const handleBack = () => {
    if (selectedSequence) {
      setSelectedSequence(null)
    } else {
      router.back()
    }
  }

  const handleStartSequence = (seq: Sequence) => {
    if (formation) {
      const config = getCategoryConfig(formation.category)
      setSequenceGradient(config.gradient)
    }
    setSelectedSequence(seq)
  }

  const handleSequenceComplete = (score: number, totalPoints: number) => {
    if (selectedSequence) {
      markCompleted(selectedSequence.id, selectedSequence.sequence_number + 1)
    }
    setSelectedSequence(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2D1B96]" />
      </div>
    )
  }

  if (error || !formation) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500 mb-4">
            {error?.message || 'Formation non trouvée'}
          </p>
          <button
            onClick={() => router.push('/formation')}
            className="px-4 py-2 bg-gray-100 rounded-xl text-sm"
          >
            Retour au catalogue
          </button>
        </div>
      </div>
    )
  }

  if (selectedSequence) {
    const config = getCategoryConfig(formation.category)
    return (
      <SequencePlayer
        sequence={selectedSequence}
        categoryGradient={config.gradient}
        onBack={handleBack}
        onComplete={handleSequenceComplete}
      />
    )
  }

  return (
    <FormationDetail
      formationId={formation.id}
      onBack={handleBack}
      onStartSequence={handleStartSequence}
    />
  )
}
