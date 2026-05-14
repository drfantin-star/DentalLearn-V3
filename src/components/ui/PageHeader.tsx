import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface PageHeaderProps {
  backHref: string
  backLabel?: string
  title: string
  subtitle?: string
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ backHref, backLabel, title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-8', className)}>
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-primary transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        {backLabel ?? 'Retour'}
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  )
}

export default PageHeader
