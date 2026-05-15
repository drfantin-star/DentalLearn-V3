import React from 'react'
import { cn } from '@/lib/utils/cn'

interface CardProps {
  variant?: 'default' | 'flat'
  className?: string
  children: React.ReactNode
}

interface CardSectionProps {
  className?: string
  children: React.ReactNode
}

export function Card({ variant = 'default', className, children }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl',
        variant === 'default' && 'shadow-lg',
        variant === 'flat' && 'border border-gray-200',
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children }: CardSectionProps) {
  return (
    <div className={cn('px-6 py-4 border-b border-gray-100', className)}>
      {children}
    </div>
  )
}

export function CardBody({ className, children }: CardSectionProps) {
  return (
    <div className={cn('p-6', className)}>
      {children}
    </div>
  )
}

export default Card
