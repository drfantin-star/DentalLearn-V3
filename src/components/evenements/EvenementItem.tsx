'use client'

import React from 'react'
import Link from 'next/link'
import { MapPin, Video } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import { eventCategoryGradientStyle } from '@/lib/utils/eventCategoryGradient'

interface EvenementItemProps {
  id: string
  type: 'presentiel' | 'virtuel'
  title: string
  starts_at: string
  category: string | null
  formateur_display_name: string | null
  formateur_slug: string | null
  formateur_photo_url: string | null
  onClick: () => void
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

export default function EvenementItem({
  type,
  title,
  starts_at,
  category,
  formateur_display_name,
  formateur_slug,
  formateur_photo_url,
  onClick,
}: EvenementItemProps) {
  const dateStr = format(parseISO(starts_at), "EEEE d MMMM yyyy '·' HH'h'mm", { locale: fr })
  const gradientStyle = eventCategoryGradientStyle(category)
  const hasGradient = Boolean(gradientStyle)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      style={gradientStyle}
      className={cn(
        'rounded-xl p-4 flex items-start gap-3 cursor-pointer transition-colors',
        hasGradient
          ? 'hover:brightness-110'
          : 'bg-neutral-800 border border-neutral-700 hover:bg-neutral-700',
      )}
    >
      <div className={cn('mt-0.5 shrink-0', hasGradient ? 'text-white/80' : 'text-neutral-400')}>
        {type === 'presentiel' ? <MapPin size={16} /> : <Video size={16} />}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <p className={cn('text-xs capitalize', hasGradient ? 'text-white/75' : 'text-neutral-400')}>
          {dateStr}
        </p>
        <p className={cn('text-sm font-semibold leading-snug line-clamp-2', hasGradient ? 'text-white' : 'text-neutral-200')}>
          {title}
        </p>
        {formateur_display_name && (
          <div className="flex items-center gap-1.5 pt-0.5">
            <div className={cn('w-4 h-4 rounded-full overflow-hidden shrink-0 flex items-center justify-center', hasGradient ? 'bg-white/20' : 'bg-neutral-700')}>
              {formateur_photo_url ? (
                <img src={formateur_photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className={cn('text-[8px] font-bold', hasGradient ? 'text-white' : 'text-neutral-300')}>
                  {getInitials(formateur_display_name)}
                </span>
              )}
            </div>
            {formateur_slug ? (
              <Link
                href={`/formateurs/${formateur_slug}`}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'text-xs hover:underline',
                  hasGradient ? 'text-white/90' : 'text-neutral-400',
                )}
              >
                {formateur_display_name}
              </Link>
            ) : (
              <span className={cn('text-xs', hasGradient ? 'text-white/75' : 'text-neutral-400')}>
                {formateur_display_name}
              </span>
            )}
          </div>
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
