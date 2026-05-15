'use client'

import { useEffect, useState } from 'react'
import { Video, Clock, Users } from 'lucide-react'
import Link from 'next/link'

interface PublicSession {
  id: string
  title: string
  starts_at: string
  duration_min: number
  capacity: number | null
  registration_count: number
  places_restantes: number | null
}

interface Props {
  formateurUserId?: string
  formationId?: string
}

function formatSessionDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatSessionTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
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
      <h3 className="text-[15px] font-bold text-[#e5e5e5] mb-3">
        Prochaines masterclass live
      </h3>
      <div className="space-y-3">
        {sessions.map((s) => (
          <div
            key={s.id}
            className="rounded-2xl p-4"
            style={{ background: '#242424', border: '0.5px solid #333' }}
          >
            {/* Date + heure */}
            <div className="flex items-center gap-1.5 text-[#a78bfa] text-xs font-semibold mb-1 capitalize">
              <Video size={12} />
              <span>{formatSessionDate(s.starts_at)}</span>
              <span className="font-normal text-[#6b7280]">
                {formatSessionTime(s.starts_at)}
              </span>
            </div>

            {/* Titre */}
            <p className="text-[#e5e5e5] font-semibold text-sm leading-snug mb-2">
              {s.title}
            </p>

            {/* Durée + places + CTA */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-[#6b7280] text-xs">
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {s.duration_min} min
                </span>
                {s.places_restantes !== null && (
                  <span className="flex items-center gap-1">
                    <Users size={11} />
                    {s.places_restantes > 0
                      ? `${s.places_restantes} place${s.places_restantes > 1 ? 's' : ''}`
                      : 'Complet'}
                  </span>
                )}
              </div>
              <Link
                href={`/sessions/${s.id}`}
                className="text-xs font-semibold text-[#a78bfa] hover:text-[#c4b5fd] transition-colors shrink-0"
              >
                S'inscrire →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
