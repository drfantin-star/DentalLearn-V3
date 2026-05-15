import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/Card'

type ValueFormat = 'number' | 'percent' | 'duration'

interface KPICardProps {
  icon: LucideIcon
  label: string
  value: number | null
  subtitle: string
  valueFormat?: ValueFormat
  iconColor?: string
}

export default function KPICard({
  icon: Icon,
  label,
  value,
  subtitle,
  valueFormat = 'number',
  iconColor = 'bg-[#2D1B96]',
}: KPICardProps) {
  const isMasked = value === null || value === undefined
  const displayed = isMasked ? '—' : formatValue(value as number, valueFormat)

  return (
    <Card className="p-6 h-full">
      <div className="flex items-start gap-4">
        <div className={`${iconColor} p-3 rounded-xl shrink-0`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-600">{label}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-3xl font-bold text-gray-900 leading-none">
              {displayed}
            </p>
            {isMasked && (
              <span
                role="img"
                aria-label="Statistique masquée"
                title="Statistique masquée pour des raisons de confidentialité (moins de 5 dentistes concernés)."
                className="text-xs text-gray-400 cursor-help select-none"
              >
                ?
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">{subtitle}</p>
        </div>
      </div>
    </Card>
  )
}

function formatValue(value: number, format: ValueFormat): string {
  switch (format) {
    case 'percent':
      return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
    case 'duration': {
      const min = Math.round(value / 60)
      return `${min} min`
    }
    case 'number':
    default:
      return value.toLocaleString('fr-FR')
  }
}
