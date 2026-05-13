'use client'

// ============================================================================
// <KeyFiguresEditor> — POC-T12
//
// Liste ordonnée de chiffres clés (text[] côté BDD news_syntheses.key_figures).
// Pattern repris de T11 journal : boutons ↑↓× par ligne + bouton "+ Ajouter"
// en fin de liste. Pas de drag-drop (D-T11-01 reportée, aucune lib drag-drop
// dans le projet).
//
// État vide accepté (array vide légitime). Pas de minimum requis côté UI ;
// la validation BDD reste minimaliste (z.array(z.string().min(1)) côté
// route.ts T12-A — rejette uniquement les éléments vides individuels).
// ============================================================================

interface Props {
  value: string[]
  onChange: (next: string[]) => void
}

export function KeyFiguresEditor({ value, onChange }: Props) {
  const updateAt = (idx: number, next: string) => {
    const arr = [...value]
    arr[idx] = next
    onChange(arr)
  }

  const removeAt = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx))
  }

  const moveAt = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= value.length) return
    const arr = [...value]
    const tmp = arr[idx]
    arr[idx] = arr[target]
    arr[target] = tmp
    onChange(arr)
  }

  const addRow = () => {
    onChange([...value, ''])
  }

  return (
    <div className="space-y-1">
      {value.length === 0 ? (
        <p className="text-sm text-gray-400">Aucun chiffre clé renseigné.</p>
      ) : (
        value.map((fig, idx) => (
          <div key={idx} className="flex items-center gap-1">
            <span className="text-xs text-gray-400 w-7 shrink-0">
              [{idx + 1}]
            </span>
            <input
              type="text"
              value={fig}
              onChange={(e) => updateAt(idx, e.target.value)}
              className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Ex. 85% recouvrement à 12 mois"
            />
            <button
              type="button"
              onClick={() => moveAt(idx, -1)}
              disabled={idx === 0}
              aria-label="Déplacer vers le haut"
              className="px-2 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => moveAt(idx, 1)}
              disabled={idx === value.length - 1}
              aria-label="Déplacer vers le bas"
              className="px-2 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => removeAt(idx)}
              aria-label="Supprimer ce chiffre clé"
              className="px-2 py-1 text-xs border border-gray-300 rounded text-red-600 bg-white hover:bg-red-50"
            >
              ×
            </button>
          </div>
        ))
      )}
      <button
        type="button"
        onClick={addRow}
        className="mt-2 text-sm text-blue-600 hover:underline focus:outline-none"
      >
        + Ajouter un chiffre clé
      </button>
    </div>
  )
}
