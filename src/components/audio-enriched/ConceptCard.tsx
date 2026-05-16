'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'

import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

interface ConceptCardProps {
  term: string
  definition: string
  className?: string
}

function ConceptCardBase({ term, definition, className }: ConceptCardProps) {
  return (
    <motion.div
      key={term}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'bg-[color:var(--color-bg-card)]/30 rounded-xl p-6 min-h-[240px] flex flex-col gap-3',
        className,
      )}
    >
      <Badge variant="info" size="sm" className="self-start">
        Concept clé
      </Badge>
      <h3 className="text-lg font-semibold text-primary">{term}</h3>
      <p className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed">
        {definition}
      </p>
    </motion.div>
  )
}

export const ConceptCard = memo(ConceptCardBase)
