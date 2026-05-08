'use client'

import type { SceneTemplate } from '@/lib/timeline/schema'

type CausalTemplate = Extract<SceneTemplate, { kind: 'causal' }>
type CausalNode = NonNullable<CausalTemplate['nodes']>[number]
type CausalEdge = NonNullable<CausalTemplate['edges']>[number]

interface Props {
  template: CausalTemplate
  onChange: (next: CausalTemplate) => void
}

const MAX_NODES = 5
const MIN_NODES = 2

/**
 * Éditeur causal V1 (POC-T6.3) — minimaliste.
 *
 * On cible le mode "nodes+edges" (spec POC §5.2). Le mode legacy
 * "cause+effects" reste valide côté schéma mais n'est pas exposé en édition
 * (les défauts T6.3 produisent du nodes+edges). Si l'admin tombe sur une
 * scène en mode legacy, on bascule sa structure vers nodes+edges au premier
 * onChange (handler `migrateLegacyIfNeeded`).
 *
 * Drag&drop visuel = BLOC 2.
 */

function migrateLegacyIfNeeded(t: CausalTemplate): CausalTemplate {
  if (t.nodes && t.nodes.length >= MIN_NODES) return t
  // Legacy → produire un mode graphe minimal cohérent.
  if (t.cause && t.effects && t.effects.length > 0) {
    const nodes: CausalNode[] = [
      { id: 'n0', text: t.cause.text, ...(t.cause.subtitle ? { subtitle: t.cause.subtitle } : {}) },
      ...t.effects.map((eff, i) => ({
        id: `n${i + 1}`,
        text: eff.text,
        ...(eff.subtitle ? { subtitle: eff.subtitle } : {}),
      })),
    ]
    const edges: CausalEdge[] = t.effects.map((_, i) => ({
      from: 'n0',
      to: `n${i + 1}`,
    }))
    return { kind: 'causal', nodes, edges }
  }
  // Vraiment vide : on injecte un défaut (ne devrait pas arriver, le schéma
  // refuse cet état).
  return {
    kind: 'causal',
    nodes: [
      { id: 'n1', text: 'Cause' },
      { id: 'n2', text: 'Effet' },
    ],
    edges: [{ from: 'n1', to: 'n2' }],
  }
}

export function CausalEditor({ template: rawTemplate, onChange }: Props) {
  const template = migrateLegacyIfNeeded(rawTemplate)
  const nodes = template.nodes ?? []
  const edges = template.edges ?? []

  function update(nextNodes: CausalNode[], nextEdges: CausalEdge[]) {
    onChange({ kind: 'causal', nodes: nextNodes, edges: nextEdges })
  }

  function addNode() {
    if (nodes.length >= MAX_NODES) return
    // Generate unique id
    let i = 1
    while (nodes.some((n) => n.id === `n${i}`)) i += 1
    const newNodes = [...nodes, { id: `n${i}`, text: `Nœud ${i}` } as CausalNode]
    update(newNodes, edges)
  }

  function removeNode(idx: number) {
    if (nodes.length <= MIN_NODES) return
    const removed = nodes[idx]
    const newNodes = nodes.filter((_, i) => i !== idx)
    // Filtrer les edges référençant le node supprimé.
    const newEdges = edges.filter(
      (e) => e.from !== removed.id && e.to !== removed.id
    )
    update(newNodes, newEdges)
  }

  function setNodeText(idx: number, text: string) {
    const newNodes = nodes.map((n, i) => (i === idx ? { ...n, text } : n))
    update(newNodes, edges)
  }

  function addEdge() {
    if (nodes.length < 2) return
    update(nodes, [...edges, { from: nodes[0].id!, to: nodes[1].id! }])
  }

  function removeEdge(idx: number) {
    update(nodes, edges.filter((_, i) => i !== idx))
  }

  function setEdge(idx: number, next: Partial<CausalEdge>) {
    const newEdges = edges.map((e, i) => (i === idx ? { ...e, ...next } : e))
    update(nodes, newEdges)
  }

  return (
    <div className="space-y-4">
      {/* Nodes */}
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Nœuds ({nodes.length}/{MAX_NODES})
        </p>
        {nodes.map((node, idx) => (
          <div
            key={node.id ?? idx}
            className="flex items-center gap-2 rounded-lg border border-white/5 bg-[color:var(--color-bg-card)]/40 p-2"
          >
            <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--color-text-muted)]">
              {node.id ?? '?'}
            </span>
            <input
              type="text"
              value={node.text}
              onChange={(e) => setNodeText(idx, e.target.value)}
              maxLength={60}
              className="flex-1 rounded-md border border-white/10 bg-[color:var(--color-bg-input)] px-2 py-1 text-sm text-white focus:border-ds-turquoise focus:outline-none"
            />
            {nodes.length > MIN_NODES && (
              <button
                type="button"
                onClick={() => removeNode(idx)}
                className="rounded p-1 text-[color:var(--color-text-muted)] hover:bg-red-500/15 hover:text-red-300"
                aria-label="Retirer ce nœud"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addNode}
          disabled={nodes.length >= MAX_NODES}
          className="rounded-lg border border-dashed border-white/15 px-3 py-1.5 text-xs text-[color:var(--color-text-secondary)] hover:border-ds-turquoise/40 hover:text-white disabled:opacity-40"
        >
          + Nœud
        </button>
      </div>

      {/* Edges */}
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Liens ({edges.length})
        </p>
        {edges.map((edge, idx) => (
          <div
            key={idx}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-[color:var(--color-bg-card)]/40 p-2"
          >
            <select
              value={edge.from}
              onChange={(e) => setEdge(idx, { from: e.target.value })}
              className="rounded-md border border-white/10 bg-[color:var(--color-bg-input)] px-2 py-1 text-xs text-white focus:border-ds-turquoise focus:outline-none"
            >
              {nodes.map((n) => (
                <option key={`from-${n.id}`} value={n.id ?? ''}>
                  {n.id} — {n.text.slice(0, 24)}
                </option>
              ))}
            </select>
            <span className="text-[color:var(--color-text-muted)]">→</span>
            <select
              value={edge.to}
              onChange={(e) => setEdge(idx, { to: e.target.value })}
              className="rounded-md border border-white/10 bg-[color:var(--color-bg-input)] px-2 py-1 text-xs text-white focus:border-ds-turquoise focus:outline-none"
            >
              {nodes.map((n) => (
                <option key={`to-${n.id}`} value={n.id ?? ''}>
                  {n.id} — {n.text.slice(0, 24)}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={edge.label ?? ''}
              onChange={(e) => {
                const v = e.target.value
                const next: Partial<CausalEdge> = { label: v.length === 0 ? undefined : v }
                if (v.length === 0) {
                  // Forcer la suppression côté objet.
                  const newEdges = edges.map((ed, i) => {
                    if (i !== idx) return ed
                    const copy = { ...ed }
                    delete copy.label
                    return copy
                  })
                  update(nodes, newEdges)
                } else {
                  setEdge(idx, next)
                }
              }}
              maxLength={40}
              placeholder="Libellé (optionnel)"
              className="flex-1 rounded-md border border-white/10 bg-[color:var(--color-bg-input)] px-2 py-1 text-xs text-white focus:border-ds-turquoise focus:outline-none"
            />
            <button
              type="button"
              onClick={() => removeEdge(idx)}
              className="rounded p-1 text-[color:var(--color-text-muted)] hover:bg-red-500/15 hover:text-red-300"
              aria-label="Retirer ce lien"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addEdge}
          disabled={nodes.length < 2}
          className="rounded-lg border border-dashed border-white/15 px-3 py-1.5 text-xs text-[color:var(--color-text-secondary)] hover:border-ds-turquoise/40 hover:text-white disabled:opacity-40"
        >
          + Lien
        </button>
      </div>
    </div>
  )
}
