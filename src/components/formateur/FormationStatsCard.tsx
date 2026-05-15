import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Award, CheckCircle, Headphones, Star, Users } from 'lucide-react'
import type { FormateurStatsPerFormation } from '@/lib/auth/rbac'

interface FormationStatsCardProps {
  stats: FormateurStatsPerFormation
}

export default function FormationStatsCard({ stats }: FormationStatsCardProps) {
  return (
    <Card className="overflow-hidden flex flex-col">
      <div className="relative h-32 w-full bg-gradient-to-br from-primary to-[#5B3FD9]">
        {stats.formation_cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={stats.formation_cover}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : null}
        {stats.is_primary && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 bg-white/95 backdrop-blur text-primary text-xs font-semibold rounded-full px-3 py-1 shadow">
            <Star className="w-3.5 h-3.5" />
            Intervenant principal
          </span>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <Link
          href={`/formation/${stats.formation_category ?? ''}?formation=${stats.formation_slug}`}
          className="text-lg font-bold text-gray-900 hover:text-primary transition-colors line-clamp-2"
        >
          {stats.formation_title}
        </Link>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <MiniKPI icon={Users} label="Inscrits" value={stats.inscrits} />
          <MiniKPI
            icon={CheckCircle}
            label="Complétion"
            value={stats.completion_rate}
            format="percent"
          />
          <MiniKPI icon={Headphones} label="Écoutes" value={stats.ecoutes} />
          <MiniKPI
            icon={Award}
            label="Points"
            value={stats.points_distribues}
          />
        </div>
      </div>
    </Card>
  )
}

function MiniKPI({
  icon: Icon,
  label,
  value,
  format = 'number',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | null
  format?: 'number' | 'percent'
}) {
  const isMasked = value === null || value === undefined
  const displayed = isMasked
    ? '—'
    : format === 'percent'
      ? `${(value as number).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
      : (value as number).toLocaleString('fr-FR')

  return (
    <div className="flex items-center gap-2">
      <div className="bg-primary/10 p-1.5 rounded-lg shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-base font-semibold text-gray-900 flex items-center gap-1">
          {displayed}
          {isMasked && (
            <span
              role="img"
              aria-label="Statistique masquée"
              title="Statistique masquée — moins de 5 dentistes concernés."
              className="text-[10px] text-gray-400 cursor-help select-none"
            >
              ?
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
