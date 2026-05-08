'use client'

import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'

/**
 * Helper drag-reorder vertical (POC-T6.4.c).
 *
 * Wrapper léger autour de `<DndContext>` + `<SortableContext>` pour les
 * listes éditables internes (cards d'un Grid, steps d'un Flowchart, figures,
 * events, etc.).
 *
 * Pattern render-props : le caller fournit `renderItem(item, idx, handleProps)`
 * où `handleProps` est destiné à être étalé sur la poignée drag (bouton avec
 * icône ⋮⋮). Le wrapper sortable + le style transform sont gérés en interne
 * par `<SortableItem>`.
 *
 * Accessibilité : keyboard sensor branché par défaut (Tab → handle → Espace
 * pour saisir → flèches haut/bas pour déplacer → Espace pour déposer).
 */

/**
 * Props à étaler sur l'élément qui sert de poignée drag (icône ⋮⋮).
 *  - `attributes` : a11y attributes dnd-kit (rôle, aria-roledescription, etc.)
 *  - `listeners`  : handlers pointer/keyboard (peut être undefined avant mount)
 *  - `isDragging` : utile pour styler le handle pendant le drag
 */
export interface DragHandleProps {
  attributes: Record<string, unknown>
  listeners: Record<string, unknown> | undefined
  isDragging: boolean
}

interface SortableListProps<T> {
  items: T[]
  /** Identifiant stable et unique de chaque item (utilisé comme key dnd-kit). */
  getItemId: (item: T, index: number) => string
  onReorder: (next: T[]) => void
  renderItem: (
    item: T,
    index: number,
    dragHandleProps: DragHandleProps
  ) => ReactNode
  /** Optionnel : classe appliquée au conteneur de la liste. */
  className?: string
}

export function SortableList<T>({
  items,
  getItemId,
  onReorder,
  renderItem,
  className,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const ids = items.map((item, idx) => getItemId(item, idx))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    onReorder(arrayMove(items, oldIndex, newIndex))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item, idx) => (
            <SortableItem
              key={ids[idx]}
              id={ids[idx]}
              render={(handleProps) => renderItem(item, idx, handleProps)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

interface SortableItemProps {
  id: string
  render: (dragHandleProps: DragHandleProps) => ReactNode
}

function SortableItem({ id, render }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const handleProps: DragHandleProps = {
    attributes: attributes as unknown as Record<string, unknown>,
    listeners,
    isDragging,
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 30 : undefined,
        position: 'relative',
      }}
    >
      {render(handleProps)}
    </div>
  )
}

/**
 * Composant utilitaire : poignée drag standard (icône ⋮⋮). Applique les
 * `attributes` + `listeners` passés par `SortableList`. Visuellement
 * compatible avec le design DentalLearn (couleurs ds-turquoise / muted).
 */
export function DragHandle({
  attributes,
  listeners,
  isDragging,
  className,
  ariaLabel = 'Réordonner (drag)',
}: DragHandleProps & {
  className?: string
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      {...attributes}
      {...(listeners ?? {})}
      className={
        className ??
        `flex h-7 w-5 shrink-0 cursor-grab items-center justify-center rounded text-[color:var(--color-text-muted)] hover:bg-white/5 hover:text-white active:cursor-grabbing ${
          isDragging ? 'text-ds-turquoise' : ''
        }`
      }
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <circle cx="9" cy="6" r="1.5" />
        <circle cx="15" cy="6" r="1.5" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="18" r="1.5" />
        <circle cx="15" cy="18" r="1.5" />
      </svg>
    </button>
  )
}
