import React from 'react'

export type BadgeVariant = 'cp' | 'bonus' | 'epp' | 'nouveau' | 'populaire'

const variantStyles: Record<BadgeVariant, string> = {
  cp: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  bonus: 'bg-yellow-50 text-yellow-600 border-yellow-200',
  epp: 'bg-[#E0F7F5] text-[#00D1C1] border-[#B2F0EA]',
  nouveau: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  populaire: 'bg-orange-50 text-orange-600 border-orange-200',
}

const variantLabels: Record<BadgeVariant, string> = {
  cp: 'CP',
  bonus: 'Bonus',
  epp: 'EPP',
  nouveau: 'Nouveau',
  populaire: 'Populaire',
}

interface BadgeProps {
  variant: BadgeVariant
  label?: string // Override du label par défaut
  className?: string
}

export default function Badge({ variant, label, className = '' }: BadgeProps) {
  return (
    <span
      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${variantStyles[variant]} ${className}`}
    >
      {label || variantLabels[variant]}
    </span>
  )
}
