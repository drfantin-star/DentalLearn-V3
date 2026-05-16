'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { FormationAudioBatchBlock } from '@/components/admin/formations/FormationAudioBatchBlock'

interface SequenceLite {
  id: string
  sequence_number: number
  title: string
  course_media_url: string | null
}

interface FormationWithSequences {
  id: string
  title: string
  sequences: SequenceLite[]
}

export default function FormationAudioBatchPage() {
  const params = useParams()
  const formationId = params.id as string

  const [data, setData] = useState<FormationWithSequences | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)
      // Un seul round-trip Supabase : titre formation + liste sequences.
      const { data: formation, error: fetchErr } = await supabase
        .from('formations')
        .select(
          'id, title, sequences(id, sequence_number, title, course_media_url)',
        )
        .eq('id', formationId)
        .single()

      if (cancelled) return
      if (fetchErr) {
        setError(fetchErr.message)
        setLoading(false)
        return
      }
      if (!formation) {
        setError('Formation introuvable.')
        setLoading(false)
        return
      }

      const sequences = (formation.sequences ?? []) as SequenceLite[]
      sequences.sort((a, b) => a.sequence_number - b.sequence_number)
      setData({
        id: formation.id,
        title: formation.title,
        sequences,
      })
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [formationId])

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="text-sm text-gray-500 mb-4">
          <Link
            href="/admin/formations"
            className="hover:text-gray-900 inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" />
            Formations
          </Link>
          <span className="mx-2">›</span>
          {data?.title ? (
            <Link
              href={`/admin/formations/${formationId}`}
              className="hover:text-gray-900"
            >
              {data.title}
            </Link>
          ) : (
            <span>…</span>
          )}
          <span className="mx-2">›</span>
          <span className="text-gray-900">Génération audio batch</span>
        </nav>

        <h1 className="text-2xl font-semibold text-gray-900 mb-6">
          Génération audio batch
        </h1>

        {loading && (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Chargement…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <FormationAudioBatchBlock
            formationId={data.id}
            sequences={data.sequences}
          />
        )}
      </div>
    </div>
  )
}
