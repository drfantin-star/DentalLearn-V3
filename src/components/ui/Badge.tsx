import React from 'react'
import { cn } from '@/lib/utils/cn'

export type BadgeVariant =
  // Métier
  | 'cp'
  | 'bonus'
  | 'epp'
  | 'nouveau'
  | 'populaire'
  // Sémantiques génériques (light theme)
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral'
  // Catégories news (dark theme translucide)
  | 'news-scientifique'
  | 'news-pratique'

export type BadgeSize = 'sm' | 'md' | 'lg'

interface BadgeProps {
  variant: BadgeVariant
  size?: BadgeSize
  className?: string
  children?: React.ReactNode
  /** @deprecated Use children instead. Kept for backward compatibility. */
  label?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  cp: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  bonus: 'bg-yellow-50 text-yellow-600 border-yellow-200',
  epp: 'bg-[#E0F7F5] text-accent border-[#B2F0EA]',
  nouveau: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  populaire: 'bg-orange-50 text-orange-600 border-orange-200',
  info: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  neutral: 'bg-gray-100 text-gray-700 border-gray-200',
  'news-scientifique': 'bg-blue-500/20 text-blue-300 border-blue-400/30',
  'news-pratique': 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
}

const variantLabels: Partial<Record<BadgeVariant, string>> = {
  cp: 'CP',
  bonus: 'Bonus',
  epp: 'EPP',
  nouveau: 'Nouveau',
  populaire: 'Populaire',
}

// size sm + md → pill style (bold uppercase, with border)
// size lg → tag style (medium, sentence-case, no border)
// Exception: news-* variants in size md drop bold/uppercase (dark-theme tags).
const sizeBase: Record<BadgeSize, string> = {
  sm: 'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border',
  md: 'text-[10px] px-2 py-0.5 rounded-full border',
  lg: 'text-xs font-medium px-2 py-1 rounded-full',
}

const NEWS_VARIANTS = new Set<BadgeVariant>(['news-scientifique', 'news-pratique'])

function typographyForMd(variant: BadgeVariant): string {
  return NEWS_VARIANTS.has(variant) ? 'font-medium' : 'font-bold uppercase'
}

export default function Badge({
  variant,
  size = 'md',
  className,
  children,
  label,
}: BadgeProps) {
  if (
    process.env.NODE_ENV === 'development' &&
    children !== undefined &&
    label !== undefined
  ) {
    // eslint-disable-next-line no-console
    console.warn(
      '[Badge] Both `children` and `label` were provided. `children` takes precedence; `label` is deprecated.',
    )
  }

  const content = children ?? label ?? variantLabels[variant] ?? null

  return (
    <span
      className={cn(
        sizeBase[size],
        size === 'md' && typographyForMd(variant),
        variantStyles[variant],
        className,
      )}
    >
      {content}
    </span>
  )
}
