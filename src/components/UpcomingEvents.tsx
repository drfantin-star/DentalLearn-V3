'use client'

import { useEffect, useState } from 'react'
import { Calendar, MapPin, ExternalLink } from 'lucide-react'
import { eventCategoryGradientStyle } from '@/lib/utils/eventCategoryGradient'

interface PublicEvent {
  id: string
  title: string
  location_city: string
  starts_at: string
  ends_at: string | null
  external_registration_url: string | null
  category: string | null
}

interface Props {
  formateurUserId?: string
  formationId?: string
}

function formatEventDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatEventTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function UpcomingEvents({ formateurUserId, formationId }: Props) {
  const [events, setEvents] = useState<PublicEvent[]>([])

  useEffect(() => {
    if (!formateurUserId && !formationId) return

    const params = new URLSearchParams()
    if (formateurUserId) params.set('formateurUserId', formateurUserId)
    if (formationId) params.set('formationId', formationId)

    fetch(`/api/public/events?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: PublicEvent[]) => setEvents(data))
      .catch(() => {})
  }, [formateurUserId, formationId])

  if (events.length === 0) return null

  return (
    <section className="px-4 pt-5 pb-2">
      <h3 className="text-[15px] font-bold text-neutral-100 mb-3">
        Prochaines dates présentielles
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:auto-rows-fr gap-3">
        {events.map((ev) => {
          const gradientStyle = eventCategoryGradientStyle(ev.category)
          const hasGradient = Boolean(gradientStyle)
          return (
            <div
              key={ev.id}
              style={gradientStyle ?? { background: '#242424', border: '0.5px solid rgba(255,255,255,0.08)' }}
              className="rounded-2xl p-4 flex flex-col h-full"
            >
              <p className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest ${hasGradient ? 'text-white/80' : 'text-neutral-400'}`}>
                <Calendar size={12} />
                <span className="capitalize">{formatEventDate(ev.starts_at)}</span>
                <span>· {formatEventTime(ev.starts_at)}{ev.ends_at && ` – ${formatEventTime(ev.ends_at)}`}</span>
              </p>

              <div className="flex flex-1 items-center py-2">
                <h4 className={`text-lg font-semibold leading-tight line-clamp-2 ${hasGradient ? 'text-white' : 'text-neutral-100'}`}>
                  {ev.title}
                </h4>
              </div>

              <div className={`flex items-center gap-1 text-xs mb-2 ${hasGradient ? 'text-white/75' : 'text-neutral-400'}`}>
                <MapPin size={11} />
                <span>{ev.location_city}</span>
              </div>

              {ev.external_registration_url ? (
                <a
                  href={ev.external_registration_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-auto w-full rounded-xl flex items-center justify-center gap-1.5 font-bold py-2.5 text-sm border ${hasGradient ? 'border-white/25 text-white' : 'border-white/15 text-neutral-100'}`}
                >
                  S'inscrire
                  <ExternalLink size={13} />
                </a>
              ) : (
                <span className={`mt-auto w-full rounded-xl flex items-center justify-center gap-1.5 font-bold py-2.5 text-sm border ${hasGradient ? 'border-white/25 text-white' : 'border-white/15 text-neutral-100'}`}>
                  Contacter le formateur
                </span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
