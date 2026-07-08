'use client'

import { useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { HomeFeedCard } from '@/components/home/HomeFeedCard'
import SophieAutopilotModal from './SophieAutopilotModal'

interface PlanItem {
  id: string
  itemType: string
  axeId: number
  axeShortName: string
  title: string
  estMinutes: number | null
  status: string
  href: string
}

interface AutopilotData {
  needsSetup: boolean
  weeklyMinutes: number | null
  focus: string[]
  monthKey: string
  items: PlanItem[]
}

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

  const todoCount = data?.items?.filter((it: PlanItem) => it.status === 'todo').length ?? 0
  const totalCount = data?.items?.length ?? 0
  const allDone = totalCount > 0 && todoCount === 0

  let title: string
  if (!data) {
    title = '...'
  } else if (data.needsSetup) {
    title = 'Cree ton plan du mois'
  } else if (allDone) {
    title = 'Plan du mois termine 👏'
  } else {
    title = `${todoCount} action${todoCount > 1 ? 's' : ''} a faire ce mois-ci`
  }

  return (
    <>
      <HomeFeedCard
        accent="teal"
        eyebrow="Sophie"
        title={title}
        icon={
          <Image
            src="/images/sophie-avatar.webp"
            alt="Sophie"
            width={104}
            height={104}
            className="h-full w-full object-cover"
            priority
          />
        }
        onClick={() => setOpen(true)}
        ariaLabel="Ouvrir le coaching Sophie"
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
