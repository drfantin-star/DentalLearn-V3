import { Award, CheckCircle, Headphones, Users } from 'lucide-react'
import { requireFormateurOrRedirect } from '@/lib/auth/guards'
import { getFormateurStats } from '@/lib/auth/rbac'
import EmptyStateNoFormations from '@/components/formateur/EmptyStateNoFormations'
import FormationStatsCard from '@/components/formateur/FormationStatsCard'
import KPICard from '@/components/formateur/KPICard'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Tableau de bord · Espace Formateur',
}

export default async function FormateurDashboardPage() {
  const userId = await requireFormateurOrRedirect('/formateur/dashboard')
  const stats = await getFormateurStats(userId)

  if (stats.formations_count === 0) {
    return <EmptyStateNoFormations />
  }

  const periodLabel = formatPeriodLabel(
    stats.period.date_from,
    stats.period.date_to
  )

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-600 mt-1">{periodLabel}</p>
      </header>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Aperçu global
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            icon={Users}
            label="Inscrits total"
            value={stats.global.inscrits_total}
            subtitle="dentistes inscrits à vos formations"
            iconColor="bg-blue-500"
          />
          <KPICard
            icon={CheckCircle}
            label="Taux de complétion"
            value={stats.global.completion_rate}
            valueFormat="percent"
            subtitle="des dentistes ont terminé sur la période"
            iconColor="bg-green-500"
          />
          <KPICard
            icon={Headphones}
            label="Écoutes audio"
            value={stats.global.ecoutes_audio}
            subtitle="écoutes de podcasts sur la période"
            iconColor="bg-purple-500"
          />
          <KPICard
            icon={Award}
            label="Points distribués"
            value={stats.global.points_distribues}
            subtitle="points totaux gagnés par vos dentistes"
            iconColor="bg-orange-500"
          />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Par formation
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {stats.per_formation.map((f) => (
            <FormationStatsCard key={f.formation_id} stats={f} />
          ))}
        </div>
      </section>

      <p className="text-xs text-gray-500 mt-10 text-center">
        Données agrégées — conformément à notre politique RGPD, aucun
        apprenant n&apos;est identifié individuellement.
      </p>
    </div>
  )
}

function formatPeriodLabel(dateFromIso: string, dateToIso: string): string {
  const fmt = (iso: string) => {
    const [, m, d] = iso.split('-')
    return `${d}/${m}`
  }
  return `Sur les 30 derniers jours : du ${fmt(dateFromIso)} au ${fmt(dateToIso)}`
}
