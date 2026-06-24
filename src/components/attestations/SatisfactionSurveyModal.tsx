'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Star, Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  isOpen: boolean
  formationId: string
  formationTitle: string
  onClose: () => void
  onSubmitted: () => void
}

interface StarRatingProps {
  value: number
  onChange: (value: number) => void
  ariaLabelPrefix: string
}

function StarRating({ value, onChange, ariaLabelPrefix }: StarRatingProps) {
  const [hover, setHover] = useState(0)
  const display = hover || value

  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= display
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${ariaLabelPrefix} : ${n} sur 5`}
            className="p-1.5 rounded-lg transition-transform active:scale-90 hover:scale-110"
          >
            <Star
              size={28}
              className={filled ? 'text-amber-400' : 'text-[#3a3a3a]'}
              fill={filled ? 'currentColor' : 'none'}
              strokeWidth={1.75}
            />
          </button>
        )
      })}
    </div>
  )
}

export function SatisfactionSurveyModal({
  isOpen,
  formationId,
  formationTitle,
  onClose,
  onSubmitted,
}: Props) {
  const [ratingOverall, setRatingOverall] = useState(0)
  const [ratingContent, setRatingContent] = useState(0)
  const [ratingPedagogy, setRatingPedagogy] = useState(0)
  const [ratingErgonomics, setRatingErgonomics] = useState(0)
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null)
  const [strongPoints, setStrongPoints] = useState('')
  const [improvementPoints, setImprovementPoints] = useState('')
  const [freeComment, setFreeComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showValidationError, setShowValidationError] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  // Body scroll lock + focus trap initial + Escape
  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    closeBtnRef.current?.focus()

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKey)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const ratingsValid =
    ratingOverall >= 1 && ratingOverall <= 5 &&
    ratingContent >= 1 && ratingContent <= 5 &&
    ratingPedagogy >= 1 && ratingPedagogy <= 5 &&
    ratingErgonomics >= 1 && ratingErgonomics <= 5
  const recommendValid = wouldRecommend !== null
  const formValid = ratingsValid && recommendValid

  const handleSubmit = async () => {
    if (!formValid) {
      setShowValidationError(true)
      return
    }
    setSubmitting(true)
    setError(null)
    setShowValidationError(false)

    try {
      const supabase = createClient()
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) throw new Error('Non authentifié')

      const { error: insertErr } = await supabase
        .from('satisfaction_surveys')
        .insert({
          user_id: user.id,
          formation_id: formationId,
          rating_overall: ratingOverall,
          rating_content: ratingContent,
          rating_pedagogy: ratingPedagogy,
          rating_ergonomics: ratingErgonomics,
          would_recommend: wouldRecommend,
          strong_points: strongPoints.trim() || null,
          improvement_points: improvementPoints.trim() || null,
          free_comment: freeComment.trim() || null,
        })

      if (insertErr) {
        // Code 23505 = UNIQUE violation : la réponse existe déjà.
        // On considère le check satisfait et on laisse l'attestation se générer.
        if (insertErr.code === '23505') {
          onSubmitted()
          onClose()
          return
        }
        throw insertErr
      }

      onSubmitted()
      onClose()
    } catch (err: any) {
      console.error('SatisfactionSurveyModal submit error:', err)
      setError(err.message || "Erreur lors de l'enregistrement du questionnaire")
    } finally {
      setSubmitting(false)
    }
  }

  const ratingBlocks: Array<{
    label: string
    value: number
    onChange: (v: number) => void
  }> = [
    { label: 'Note globale', value: ratingOverall, onChange: setRatingOverall },
    { label: 'Contenu pédagogique', value: ratingContent, onChange: setRatingContent },
    { label: 'Format et pédagogie', value: ratingPedagogy, onChange: setRatingPedagogy },
    { label: 'Ergonomie et expérience utilisateur', value: ratingErgonomics, onChange: setRatingErgonomics },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-gray-900/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="satisfaction-survey-title"
    >
      <div
        ref={containerRef}
        className="w-full sm:max-w-xl h-full sm:h-auto sm:max-h-[90vh] flex flex-col rounded-none sm:rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#0a0a0a', border: '1px solid #2a2a2a' }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-3 px-5 py-4 flex-shrink-0"
          style={{ background: '#1a1a1a', borderBottom: '1px solid #2a2a2a' }}
        >
          <div className="min-w-0">
            <h2
              id="satisfaction-survey-title"
              className="text-lg font-bold leading-snug"
              style={{ color: '#e5e5e5' }}
            >
              Votre avis sur cette formation
            </h2>
            <p className="text-sm mt-1 truncate" style={{ color: '#a3a3a3' }}>
              {formationTitle}
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-2 rounded-full flex-shrink-0 transition-colors"
            style={{ color: '#a3a3a3' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#242424')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          <p className="text-xs leading-relaxed" style={{ color: '#a3a3a3' }}>
            Votre retour est requis pour finaliser votre attestation officielle (indicateur Qualiopi #30). Cela ne prend qu'une minute.
          </p>

          {/* Ratings */}
          <div className="space-y-5">
            {ratingBlocks.map((block) => (
              <div key={block.label}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold" style={{ color: '#e5e5e5' }}>
                    {block.label}
                  </label>
                  <span className="text-xs" style={{ color: '#a3a3a3' }}>
                    {block.value > 0 ? `${block.value}/5` : 'Non noté'}
                  </span>
                </div>
                <StarRating
                  value={block.value}
                  onChange={block.onChange}
                  ariaLabelPrefix={block.label}
                />
              </div>
            ))}
          </div>

          {/* Recommendation */}
          <div>
            <label className="text-sm font-semibold block mb-2" style={{ color: '#e5e5e5' }}>
              Recommanderiez-vous Certily à un confrère ?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setWouldRecommend(true)}
                aria-pressed={wouldRecommend === true}
                className="h-20 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
                style={
                  wouldRecommend === true
                    ? { background: 'rgba(6,78,59,0.4)', borderColor: '#059669', color: '#10b981' }
                    : { background: '#1a1a1a', borderColor: '#2a2a2a', color: '#a3a3a3' }
                }
              >
                <Check size={22} />
                <span className="text-base font-bold">Oui</span>
              </button>
              <button
                type="button"
                onClick={() => setWouldRecommend(false)}
                aria-pressed={wouldRecommend === false}
                className="h-20 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
                style={
                  wouldRecommend === false
                    ? { background: 'rgba(69,10,10,0.4)', borderColor: '#ef4444', color: '#f87171' }
                    : { background: '#1a1a1a', borderColor: '#2a2a2a', color: '#a3a3a3' }
                }
              >
                <X size={22} />
                <span className="text-base font-bold">Non</span>
              </button>
            </div>
          </div>

          {/* Open-ended feedback */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold block mb-2" style={{ color: '#e5e5e5' }}>
                Points forts
                <span className="text-xs font-normal ml-1" style={{ color: '#737373' }}>(optionnel)</span>
              </label>
              <textarea
                value={strongPoints}
                onChange={(e) => setStrongPoints(e.target.value)}
                placeholder="Ce qui vous a plu dans cette formation…"
                rows={3}
                className="w-full px-3 py-2 rounded-xl text-sm resize-y outline-none focus:ring-2 focus:ring-primary"
                style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e5e5e5' }}
              />
            </div>

            <div>
              <label className="text-sm font-semibold block mb-2" style={{ color: '#e5e5e5' }}>
                Points à améliorer
                <span className="text-xs font-normal ml-1" style={{ color: '#737373' }}>(optionnel)</span>
              </label>
              <textarea
                value={improvementPoints}
                onChange={(e) => setImprovementPoints(e.target.value)}
                placeholder="Ce qui pourrait être amélioré…"
                rows={3}
                className="w-full px-3 py-2 rounded-xl text-sm resize-y outline-none focus:ring-2 focus:ring-primary"
                style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e5e5e5' }}
              />
            </div>

            <div>
              <label className="text-sm font-semibold block mb-2" style={{ color: '#e5e5e5' }}>
                Commentaire libre
                <span className="text-xs font-normal ml-1" style={{ color: '#737373' }}>(optionnel)</span>
              </label>
              <textarea
                value={freeComment}
                onChange={(e) => setFreeComment(e.target.value)}
                placeholder="Tout autre retour que vous souhaitez partager…"
                rows={3}
                className="w-full px-3 py-2 rounded-xl text-sm resize-y outline-none focus:ring-2 focus:ring-primary"
                style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e5e5e5' }}
              />
            </div>
          </div>

          {showValidationError && !formValid && (
            <p className="text-red-400 text-sm">
              Merci de noter les 4 critères et d'indiquer si vous recommanderiez Certily.
            </p>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-4 flex-shrink-0"
          style={{ background: '#1a1a1a', borderTop: '1px solid #2a2a2a' }}
        >
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || (showValidationError && !formValid)}
            className="w-full flex items-center justify-center gap-2 bg-white text-[#0a0a0a] hover:bg-[#e5e5e5] px-4 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Enregistrement…</span>
              </>
            ) : (
              <span>Valider et obtenir mon attestation</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SatisfactionSurveyModal
