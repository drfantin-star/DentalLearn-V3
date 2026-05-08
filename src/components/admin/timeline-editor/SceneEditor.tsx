'use client'

import type { Scene } from '@/lib/timeline/schema'

import { SceneMetadataEditor } from './SceneMetadataEditor'
import { SceneTemplateEditor } from './SceneTemplateEditor'

/**
 * Container colonne droite (POC-T6.2 + T6.3) : métadonnées + template.
 */

interface Props {
  scene: Scene
  onChange: (next: Scene) => void
  audioDurationSec: number
  siblingScenes: Scene[]
}

export function SceneEditor({
  scene,
  onChange,
  audioDurationSec,
  siblingScenes,
}: Props) {
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto pr-1">
      <SceneMetadataEditor
        scene={scene}
        onChange={onChange}
        audioDurationSec={audioDurationSec}
        siblingScenes={siblingScenes}
      />
      <SceneTemplateEditor scene={scene} onChange={onChange} />
    </div>
  )
}
