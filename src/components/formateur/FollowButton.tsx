'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

interface FollowButtonProps {
  slug: string
  initialFollowing: boolean
  initialCount: number
}

export function FollowButton({ slug, initialFollowing, initialCount }: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    const prev = { following, count }
    // Optimistic update
    setFollowing(!following)
    setCount(following ? count - 1 : count + 1)
    setLoading(true)

    try {
      const method = following ? 'DELETE' : 'POST'
      const res = await fetch(`/api/formateurs/${slug}/follow`, { method })
      if (!res.ok) throw new Error('Erreur réseau')
    } catch {
      // Revert on error
      setFollowing(prev.following)
      setCount(prev.count)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn('flex flex-col items-start gap-1')}>
      <Button
        variant={following ? 'primary' : 'secondary'}
        size="md"
        loading={loading}
        onClick={() => { void handleClick() }}
      >
        {following ? 'Abonné ✓' : 'Suivre'}
      </Button>
      <span className="text-xs text-[#6b7280]">
        {count} abonné{count > 1 ? 's' : ''}
      </span>
    </div>
  )
}
