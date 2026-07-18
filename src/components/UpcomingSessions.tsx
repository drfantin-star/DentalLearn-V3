'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Video, Clock, Users } from 'lucide-react'
import { eventCategoryGradientStyle } from '@/lib/utils/eventCategoryGradient'

interface PublicSession {
  id: string
  title: string
  starts_at: string
  duration_min: number
  capacity: number | null
  registration_count: number
  places_restantes: number | null
  category: string | null
}

interface Props {
  formateurUserId?: string
  formationId?: string
}

function formatSessionDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatSessionTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function UpcomingSessions({ formateurUserId, formationId }: Props) {
  const [sessions, setSessions] = useState<PublicSession[]>([])

  useEffect(() => {
    if (!formateurUserId && !formationId) return

    const params = new URLSearchParams()
    if (formateurUserId) params.set('formateurUserId', formateurUserId)
    if (formationId) params.set('formationId', formationId)

    fetch(`/api/public/sessions?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: PublicSession[]) => setSessions(data))
      .catch(() => {})
  }, [formateurUserId, formationId])

  if (sessions.length === 0) return null

  return (
    <section className="px-4 pt-5 pb-2">
      <h3 className="text-[15px] font-bold text-neutral-100 mb-3">
        Prochaines masterclass live
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:auto-rows-fr gap-3">
        {sessions.map((s) => {
          const gradientStyle = eventCategoryGradientStyle(s.category)
          const hasGradient = Boolean(gradientStyle)
          return (
            <div
              key={s.id}
              style={gradientStyle ?? { background: '#242424', border: '0.5px solid rgba(255,255,255,0.08)' }}
              className="rounded-2xl p-4 flex flex-col h-full"
            >
              <p className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest ${hasGradient ? 'text-white/80' : 'text-neutral-400'}`}>
                <Video size={12} />
                <span className="capitalize">{formatSessionDate(s.starts_at)}</span>
                <span>· {formatSessionTime(s.starts_at)}</span>
              </p>

              <div className="flex flex-1 items-center py-2">
                <h4 className={`text-lg font-semibold leading-tight line-clamp-2 ${hasGradient ? 'text-white' : 'text-neutral-100'}`}>
                  {s.title}
                </h4>
              </div>

              <div className={`flex items-center gap-3 text-xs mb-2 ${hasGradient ? 'text-white/75' : 'text-neutral-400'}`}>
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {s.duration_min} min
                </span>
                {s.places_restantes !== null && (
                  <span className="flex items-center gap-1">
                    <Users size={11} />
                    {s.places_restantes > 0 ? `${s.places_restantes} place${s.places_restantes > 1 ? 's' : ''}` : 'Complet'}
                  </span>
                )}
              </div>

              <Link
                href={`/sessions/${s.id}`}
                className={`mt-auto w-full rounded-xl flex items-center justify-center gap-1.5 font-bold py-2.5 text-sm border ${hasGradient ? 'border-white/25 text-white' : 'border-white/15 text-neutral-100'}`}
              >
                S'inscrire
              </Link>
            </div>
          )
        })}
      </div>
    </section>
  )
}
