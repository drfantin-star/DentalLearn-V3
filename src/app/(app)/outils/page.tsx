'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  Wrench,
  ShieldCheck,
  FileText,
  Users,
  Stethoscope,
  Zap,
  type LucideIcon,
} from 'lucide-react'

interface Tool {
  id: string
  slug: string
  title: string
  description: string | null
  icon: string | null
  href: string | null
  status: 'active' | 'coming_soon'
  is_published: boolean
  desktop_only: boolean
  order_idx: number
}

const TOOL_ICONS: Record<string, LucideIcon> = {
  'shield-check': ShieldCheck,
  'file-text': FileText,
  users: Users,
  stethoscope: Stethoscope,
  zap: Zap,
  wrench: Wrench,
}

function toolIcon(name: string | null): LucideIcon {
  return (name && TOOL_ICONS[name]) || Wrench
}

export default function OutilsPage() {
  const router = useRouter()
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data } = await supabase
        .from('tools')
        .select('*')
        .eq('is_published', true)
        .order('order_idx', { ascending: true })
      setTools((data as Tool[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <>
      {/* Header */}
      <header className="bg-gradient-to-br from-[#0d0d0d] to-[#0F7B6C] px-4 py-4">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.push('/')}
            className="p-2 -ml-2 hover:bg-white/20 rounded-xl transition-colors"
          >
            <ChevronLeft size={20} className="text-white" />
          </button>
          <h1 className="text-2xl font-black text-white">Boîte à outils</h1>
        </div>
        <p className="text-sm font-semibold text-white/80 mt-1 leading-relaxed">
          Outils métier pour votre cabinet
        </p>
      </header>

      <main className="max-w-lg mx-auto md:max-w-2xl lg:max-w-[1500px] px-4 md:px-6 lg:px-8 py-6">
        {/* Note mobile — visible uniquement < lg */}
        <div className="lg:hidden mb-5 flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-xl px-4 py-3">
          <Wrench size={16} className="text-accent shrink-0" />
          <p className="text-sm text-accent font-medium">
            À utiliser sur ordinateur — même adresse, même compte.
          </p>
        </div>

        {/* Grille des outils */}
        {loading ? (
          <div
            className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            style={{ gridAutoRows: '1fr' }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-44 rounded-2xl border border-white/10 animate-pulse"
                style={{ background: '#1a1a1a' }}
              />
            ))}
          </div>
        ) : (
          <div
            className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            style={{ gridAutoRows: '1fr' }}
          >
            {tools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        )}
      </main>
    </>
  )
}

function ToolCard({ tool }: { tool: Tool }) {
  const Icon = toolIcon(tool.icon)
  const isActive = tool.status === 'active' && tool.href

  if (isActive) {
    return (
      <Link
        href={tool.href!}
        className="flex flex-col h-full rounded-2xl border border-accent/30 bg-accent/10 p-5 hover:bg-accent/15 transition-all"
      >
        <CardInner tool={tool} Icon={Icon} />
      </Link>
    )
  }

  return (
    <div className="flex flex-col h-full rounded-2xl border border-white/10 bg-white/5 p-5 cursor-default">
      <CardInner tool={tool} Icon={Icon} coming />
    </div>
  )
}

function CardInner({
  tool,
  Icon,
  coming,
}: {
  tool: Tool
  Icon: LucideIcon
  coming?: boolean
}) {
  return (
    <>
      {/* Eyebrow */}
      <div className="flex items-center gap-2 mb-auto">
        <Icon
          size={18}
          className={coming ? 'text-white/30' : 'text-accent'}
        />
        {coming ? (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/30">
            Bientôt
          </span>
        ) : (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">
            Outil actif
          </span>
        )}
      </div>

      {/* Titre — domine la carte */}
      <h3
        className={`text-lg font-black my-3 leading-tight ${
          coming ? 'text-white/40' : 'text-white'
        }`}
      >
        {tool.title}
      </h3>

      {/* Description optionnelle */}
      {tool.description && (
        <p
          className={`text-xs leading-relaxed mb-3 ${
            coming ? 'text-white/25' : 'text-white/60'
          }`}
        >
          {tool.description}
        </p>
      )}

      {/* CTA — ancré en bas */}
      <div className="mt-auto pt-3 border-t border-white/10">
        {coming ? (
          <span className="text-xs font-semibold text-white/25">
            Disponible prochainement
          </span>
        ) : (
          <span className="text-xs font-semibold text-accent">
            Accéder →
          </span>
        )}
      </div>
    </>
  )
}
