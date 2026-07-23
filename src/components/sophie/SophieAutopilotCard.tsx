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
  alreadyStarted?: boolean
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

  // Meme filtre que PlanDuMoisSection : on masque les items deja engages
  // ailleurs (alreadyStarted) et les items faits (status === 'done').
  const restant = data?.items?.filter(
    (it: PlanItem) => it.status === 'todo' && !it.alreadyStarted,
  ).length ?? 0
  const total = data?.items?.length ?? 0

  let title: string
  if (!data) {
    title = '...'
  } else if (data.needsSetup) {
    title = 'Crée ton plan du mois'
  } else if (restant === 0) {
    title = 'Plan du mois terminé 👏'
  } else if (restant === 1) {
    // Elision : jamais « plus que 1 action ».
    title = 'Plus qu\'une action à réaliser !'
  } else if (restant < total) {
    title = `Plus que ${restant} actions à réaliser !`
  } else {
    title = `${total} actions à faire ce mois-ci`
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
