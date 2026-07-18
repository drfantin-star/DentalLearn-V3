'use client'

import { useEffect, useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { fr } from 'react-day-picker/locale'
import { CalendarDays } from 'lucide-react'
import 'react-day-picker/style.css'

interface DateTimePickerProps {
  value: string // 'YYYY-MM-DDTHH:mm' (format datetime-local), ou ''
  onChange: (value: string) => void
  placeholder?: string
  error?: boolean
  disablePast?: boolean
}

function parseValue(value: string): { date: Date | undefined; time: string } {
  if (!value) return { date: undefined, time: '' }
  const [datePart, timePart] = value.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  if (!y || !m || !d) return { date: undefined, time: '' }
  return { date: new Date(y, m - 1, d), time: timePart ?? '' }
}

function formatValue(date: Date, time: string): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}T${time || '09:00'}`
}

// Sélecteur calendrier + heure — remplace l'input datetime-local natif dans
// les modales masterclass (création formateur / proposition admin).
export default function DateTimePicker({ value, onChange, placeholder, error, disablePast }: DateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { date, time } = parseValue(value)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleDaySelect(d: Date | undefined) {
    if (!d) return
    onChange(formatValue(d, time))
  }

  function handleTimeChange(t: string) {
    onChange(formatValue(date ?? new Date(), t))
  }

  const displayLabel = date
    ? `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}${time ? ` à ${time}` : ''}`
    : ''

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 border rounded-xl px-3 py-2.5 text-sm text-left bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${
          error ? 'border-red-400' : 'border-gray-300'
        } ${displayLabel ? 'text-gray-900' : 'text-gray-400'}`}
      >
        <span className="truncate">{displayLabel || placeholder || 'Sélectionner une date'}</span>
        <CalendarDays size={16} className="text-gray-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-20 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-max">
          <DayPicker
            mode="single"
            locale={fr}
            selected={date}
            onSelect={handleDaySelect}
            disabled={disablePast ? { before: today } : undefined}
            className="dlv-daypicker"
          />
          <div className="border-t border-gray-100 pt-2 mt-1 flex items-center gap-2 px-1">
            <label className="text-xs font-semibold text-gray-600">Heure</label>
            <input
              type="time"
              value={time}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      )}
    </div>
  )
}
