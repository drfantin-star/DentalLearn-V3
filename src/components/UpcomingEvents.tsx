'use client'

import { useEffect, useState } from 'react'
import { Calendar, MapPin, ExternalLink } from 'lucide-react'

interface PublicEvent {
  id: string
  title: string
  location_city: string
  starts_at: string
  ends_at: string | null
  external_registration_url: string | null
}

interface Props {
  formateurUserId?: string
  formationId?: string
}

function formatEventDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatEventTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
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
      <h3 className="text-[15px] font-bold text-[#e5e5e5] mb-3">
        Prochaines dates présentielles
      </h3>
      <div className="space-y-3">
        {events.map((ev) => (
          <div
            key={ev.id}
            className="rounded-2xl p-4"
            style={{ background: '#242424', border: '0.5px solid #333' }}
          >
            {/* Date */}
            <div className="flex items-center gap-1.5 text-[#a78bfa] text-xs font-semibold mb-1 capitalize">
              <Calendar size={12} />
              <span>{formatEventDate(ev.starts_at)}</span>
              <span className="font-normal text-[#6b7280]">
                {formatEventTime(ev.starts_at)}
                {ev.ends_at && ` – ${formatEventTime(ev.ends_at)}`}
              </span>
            </div>

            {/* Titre */}
            <p className="text-[#e5e5e5] font-semibold text-sm leading-snug mb-2">
              {ev.title}
            </p>

            {/* Ville + CTA */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1 text-[#6b7280] text-xs">
                <MapPin size={11} />
                <span>{ev.location_city}</span>
              </div>
              {ev.external_registration_url ? (
                <a
                  href={ev.external_registration_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-semibold text-[#a78bfa] hover:text-[#c4b5fd] transition-colors shrink-0"
                >
                  S'inscrire
                  <ExternalLink size={11} />
                </a>
              ) : (
                <span className="text-xs text-[#6b7280] shrink-0">
                  Contacter le formateur
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
