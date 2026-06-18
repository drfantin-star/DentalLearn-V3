'use client'

import { ConceptCard } from '@/components/audio-enriched/ConceptCard'
import { StructuredWhiteboard } from '@/components/audio-enriched/StructuredWhiteboard'
import type { DisplayableConcept } from '@/lib/timeline/getActiveScene'
import type { Scene } from '@/lib/timeline/schema'

/**
 * <SceneWhiteboardWithConcepts> — composant présentationnel partagé.
 *
 * Rend le whiteboard structuré d'une scène + SES concepts clés regroupés EN
 * DESSOUS (arbitrage 2A : tous d'un coup). Extrait du sous-composant interne
 * `WhiteboardOrCover` de `EnrichedAudioPlayer` pour être réutilisé à
 * l'identique par la preview de l'éditeur de timeline admin
 * (`TimelinePreviewPanel`).
 *
 * Composant PUR, sans état vide : l'appelant garantit `displayedScene`
 * non-null et gère lui-même le cas « pas de scène » (placeholder côté user,
 * texte « Sélectionne une scène… » côté admin).
 *
 * `StructuredWhiteboard` consomme `currentTime` uniquement pour recalculer sa
 * propre `getActiveScene` interne ; on lui passe une valeur calée à
 * l'intérieur de la fenêtre de la scène (`start_sec + 0.5`) pour garantir
 * qu'elle affiche bien la scène voulue.
 */

interface Props {
  displayedScene: Scene
  sceneConcepts: DisplayableConcept[]
  scenes: Scene[]
}

export function SceneWhiteboardWithConcepts({
  displayedScene,
  sceneConcepts,
  scenes,
}: Props) {
  const lockedCurrentTime = displayedScene.start_sec + 0.5
  return (
    <div className="flex flex-col gap-3">
      <StructuredWhiteboard scenes={scenes} currentTime={lockedCurrentTime} />
      {/* Concepts clés de la scène active, regroupés sous le whiteboard
          (arbitrage 2A : tous d'un coup). Le conteneur parent gère le
          scroll interne si la hauteur dépasse. */}
      {sceneConcepts.length > 0 && (
        <div className="flex flex-col gap-3">
          {sceneConcepts.map((c) => (
            <ConceptCard key={c.id} term={c.term} definition={c.definition} />
          ))}
        </div>
      )}
    </div>
  )
}
