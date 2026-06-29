'use client'

import { useState, useCallback, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { HomeHeroCard } from '@/components/home/HomeHeroCard'
import SophieAvatar from './SophieAvatar'
import SophieAutopilotModal from './SophieAutopilotModal'

interface GapRow {
  axeId: number
  axeShortName: string
  actionsCompleted: number
  requiredActions: number
  progressPercent: number
  validated: boolean
}

interface PlanItem {
  id: string
  axeId: number
  axeShortName: string
  title: string
  estMinutes: number | null
  status: string
  category: string | null
  slug: string | null
}

interface AutopilotData {
  needsSetup: boolean
  weeklyMinutes: number | null
  monthKey: string
  gaps: GapRow[]
  items: PlanItem[]
}

const SOPHIE_GRADIENT = 'linear-gradient(135deg, #007A70, #00B8A9)'

export default function SophieAutopilotCard() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<AutopilotData | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/autopilot')
      if (res.ok) setData(await res.json())
    } catch {
      // ignore — card renders neutral state
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const todoCount = data?.items?.filter((it) => it.status === 'todo').length ?? 0
  const totalCount = data?.items?.length ?? 0
  const allDone = totalCount > 0 && todoCount === 0

  let title: string
  if (!data) {
    title = '...'
  } else if (data.needsSetup) {
    title = 'Fais le point avec Sophie'
  } else if (allDone) {
    title = 'Ton plan du mois — Termine \u{1F44F}'
  } else {
    title = `Ton plan du mois — ${todoCount} action${todoCount > 1 ? 's' : ''} a faire`
  }

  return (
    <>
      <HomeHeroCard
        surface="gradient"
        gradient={SOPHIE_GRADIENT}
        icon={<SophieAvatar size={48} />}
        eyebrow="Sophie"
        title={title}
        compact
        cta={{
          label: 'Ouvrir',
          icon: <Sparkles size={15} />,
          onClick: () => setOpen(true),
        }}
      />

      <SophieAutopilotModal
        open={open}
        onClose={() => setOpen(false)}
        data={data}
        onChange={fetchData}
      />
    </>
  )
}
