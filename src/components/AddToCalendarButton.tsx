'use client'

import { useState, useRef, useEffect } from 'react'
import { CalendarPlus, ChevronDown } from 'lucide-react'

interface AddToCalendarButtonProps {
  title: string
  starts_at: string
  ends_at?: string | null
  location?: string | null
  description?: string | null
  variant?: 'light' | 'dark'
  display?: 'menu' | 'icon'
}

function toCalendarDate(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '').replace('Z', 'Z')
}

function buildGoogleCalendarUrl(props: AddToCalendarButtonProps): string {
  const start = toCalendarDate(props.starts_at)
  const end = props.ends_at ? toCalendarDate(props.ends_at) : start
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: props.title,
    dates: `${start}/${end}`,
    ...(props.description ? { details: props.description } : {}),
    ...(props.location ? { location: props.location } : {}),
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function downloadIcs(props: AddToCalendarButtonProps): void {
  const start = toCalendarDate(props.starts_at)
  const end = props.ends_at ? toCalendarDate(props.ends_at) : start
  const uid = `${Date.now()}@dentallearn`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Certily//FR',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toCalendarDate(new Date().toISOString())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${props.title}`,
    ...(props.description ? [`DESCRIPTION:${props.description.replace(/\n/g, '\\n')}`] : []),
    ...(props.location ? [`LOCATION:${props.location}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

export default function AddToCalendarButton(props: AddToCalendarButtonProps) {
  const { variant = 'light', display = 'menu' } = props
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (display === 'icon') {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); downloadIcs(props) }}
        className="shrink-0 text-white hover:text-accent transition-colors"
        aria-label="Ajouter au calendrier (.ics)"
      >
        <CalendarPlus size={16} />
      </button>
    )
  }

  if (variant === 'dark') {
    return (
      <div className="flex items-center gap-2">
        <CalendarPlus size={13} className="text-white/30 shrink-0" />
        <a
          href={buildGoogleCalendarUrl(props)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
        >
          Google
        </a>
        <span className="text-white/20 text-[11px]">·</span>
        <button
          type="button"
          onClick={() => downloadIcs(props)}
          className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
        >
          .ics
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-300 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
      >
        <CalendarPlus size={15} />
        Ajouter au calendrier
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
          <a
            href={buildGoogleCalendarUrl(props)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Google Calendar
          </a>
          <button
            type="button"
            onClick={() => { downloadIcs(props); setOpen(false) }}
            className="w-full text-left flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
          >
            Télécharger .ics
          </button>
        </div>
      )}
    </div>
  )
}
