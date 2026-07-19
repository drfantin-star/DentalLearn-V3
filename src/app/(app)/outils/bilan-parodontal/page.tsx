'use client'

import DesktopOnly from '@/components/layout/DesktopOnly'
import BilanParodontalApp from '@/components/perio/BilanParodontalApp'

export default function BilanParodontalPage() {
  return (
    <DesktopOnly title="Bilan parodontal">
      <BilanParodontalApp />
    </DesktopOnly>
  )
}
