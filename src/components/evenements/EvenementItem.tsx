'use client'

import React from 'react'
import { MapPin, Video } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { EvenementItemData } from '@/types/evenements'

interface EvenementItemProps {
  id: string
  type: 'presentiel' | 'virtuel'
  title: string
  starts_at: string
  formateur_display_name: string | null
  onClick: () => void
}

export default function EvenementItem({
  type,
  title,
  starts_at,
  formateur_display_name,
  onClick,
}: EvenementItemProps) {
  const dateStr = format(parseISO(starts_at), "EEEE d MMMM yyyy '·' HH'h'mm", { locale: fr })

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      className={cn(
        'bg-neutral-800 rounded-xl border border-neutral-700 p-4',
        'flex items-start gap-3 cursor-pointer hover:bg-neutral-700 transition-colors',
      )}
    >
      <div className="mt-0.5 shrink-0 text-neutral-400">
        {type === 'presentiel' ? <MapPin size={16} /> : <Video size={16} />}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-xs text-gray-500 capitalize">{dateStr}</p>
        <p className="text-sm font-semibold text-neutral-200 leading-snug line-clamp-2">{title}</p>
        {formateur_display_name && (
          <p className="text-xs text-gray-500">{formateur_display_name}</p>
        )}
      </div>
      <div className="shrink-0">
        <Badge variant={type === 'presentiel' ? 'info' : 'success'} size="sm">
          {type === 'presentiel' ? 'Présentiel' : 'Classe virtuelle'}
        </Badge>
      </div>
    </div>
  )
}
