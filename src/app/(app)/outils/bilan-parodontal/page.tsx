'use client'

import DesktopOnly from '@/components/layout/DesktopOnly'
import LightToolSurface from '@/components/layout/LightToolSurface'
import BilanParodontalApp from '@/components/perio/BilanParodontalApp'

export default function BilanParodontalPage() {
  return (
    <DesktopOnly title="Bilan parodontal">
      <LightToolSurface>
        <BilanParodontalApp />
      </LightToolSurface>
    </DesktopOnly>
  )
}
