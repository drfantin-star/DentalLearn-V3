'use client'

import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export type ModalVariant = 'dark' | 'light'
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

interface ModalProps {
  open: boolean
  onClose: () => void
  variant?: ModalVariant
  size?: ModalSize
  closeOnBackdrop?: boolean
  closeOnEsc?: boolean
  children: React.ReactNode
  className?: string
  ariaLabel?: string
}

interface ModalHeaderProps {
  title: string
  onClose?: () => void
  children?: React.ReactNode
  className?: string
}

interface ModalBodyProps {
  children: React.ReactNode
  className?: string
  scrollable?: boolean
}

interface ModalFooterProps {
  children: React.ReactNode
  align?: 'end' | 'between' | 'center'
  className?: string
}

const backdropClasses: Record<ModalVariant, string> = {
  dark:  'bg-gray-900/70 backdrop-blur-sm',
  light: 'bg-black/40',
}

const sizeClasses: Record<ModalSize, string> = {
  sm:   'max-w-sm',
  md:   'max-w-md',
  lg:   'max-w-2xl',
  xl:   'max-w-4xl',
  full: 'max-w-[90vw] h-[90vh]',
}

export function Modal({
  open,
  onClose,
  variant = 'dark',
  size = 'md',
  closeOnBackdrop = true,
  closeOnEsc = true,
  children,
  className,
  ariaLabel,
}: ModalProps) {
  useEffect(() => {
    if (!open || !closeOnEsc) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, closeOnEsc, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200',
        backdropClasses[variant],
      )}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={cn(
          'w-full bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-auto transition-transform duration-200',
          sizeClasses[size],
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function ModalHeader({ title, onClose, children, className }: ModalHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 p-6 border-b border-gray-100',
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {children}
        <h2 className="text-lg font-bold text-gray-900 truncate">{title}</h2>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}

function ModalBody({ children, className, scrollable = true }: ModalBodyProps) {
  return (
    <div
      className={cn(
        'p-6',
        scrollable && 'max-h-[70vh] overflow-y-auto',
        className,
      )}
    >
      {children}
    </div>
  )
}

const alignClasses: Record<NonNullable<ModalFooterProps['align']>, string> = {
  end:     'justify-end',
  between: 'justify-between',
  center:  'justify-center',
}

function ModalFooter({ children, align = 'end', className }: ModalFooterProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-6 border-t border-gray-100',
        alignClasses[align],
        className,
      )}
    >
      {children}
    </div>
  )
}

Modal.Header = ModalHeader
Modal.Body = ModalBody
Modal.Footer = ModalFooter

export default Modal
