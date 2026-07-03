'use client'

import React, { useState } from 'react'
import { Search } from 'lucide-react'
import { CATEGORIES, getLabelCutoutUrl } from '@/lib/supabase/types'
import CutoutCardRender from '@/components/home/CutoutCardRender'

const SECTIONS = [
  {
    key: 'cp',
    label: 'Pratiques cliniques',
    href: '/formation',
  },
  {
    key: 'axe3',
    label: 'Relation Patient',
    href: '/patient',
  },
  {
    key: 'axe4',
    label: 'Sante Praticien',
    href: '/sante',
  },
] as const

function normalize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export default function RecherchePage() {
  const [query, setQuery] = useState('')

  const q = normalize(query.trim())

  const filtered = q
    ? CATEGORIES.filter((cat) => normalize(cat.name).includes(q))
    : CATEGORIES

  return (
    <>
      <header
        className="px-4 pt-5 pb-4"
        style={{ background: '#0F0F0F' }}
      >
        <h1 className="text-2xl font-black text-white mb-4">Recherche</h1>
        {/* Champ de recherche */}
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une categorie..."
            className="w-full rounded-2xl py-3 pl-10 pr-4 text-sm text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-white/20"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '0.5px solid rgba(255,255,255,0.10)',
            }}
          />
        </div>
      </header>

      <main
        className="px-4 pb-28 space-y-8"
        style={{ background: '#0F0F0F', minHeight: '100vh' }}
      >
        {SECTIONS.map((section) => {
          const cats = filtered.filter((cat) => cat.type === section.key)
          if (cats.length === 0) return null
          return (
            <section key={section.key}>
              <h2 className="text-base font-bold text-[#e5e5e5] mb-3">
                {section.label}
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                {cats.map((cat) => {
                  const from =
                    cat.type === 'axe3'
                      ? '/patient'
                      : cat.type === 'axe4'
                      ? '/sante'
                      : '/formation'
                  const cutoutUrl = getLabelCutoutUrl(cat)
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        window.location.href = `/formation/${cat.id}?from=${from}`
                      }}
                      className="relative rounded-2xl overflow-hidden w-full"
                      style={{ aspectRatio: '3/2', border: 'none' }}
                    >
                      {cutoutUrl ? (
                        <CutoutCardRender
                          cutoutSrc={cutoutUrl}
                          colorFrom={cat.gradient.from}
                          title={cat.name}
                          variant="theme"
                        />
                      ) : (
                        <>
                          <div
                            className="absolute inset-0"
                            style={{ background: `linear-gradient(135deg, ${cat.gradient.from}, ${cat.gradient.to})` }}
                          />
                          <div
                            className="absolute inset-0"
                            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)' }}
                          />
                          <span
                            className="absolute font-bold text-white leading-tight"
                            style={{ bottom: '10px', left: '10px', fontSize: '14px', textShadow: '0 1px 3px rgba(0,0,0,0.4)', maxWidth: 'calc(100% - 20px)' }}
                          >
                            {cat.name}
                          </span>
                        </>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}

        {filtered.length === 0 && (
          <p className="text-center text-white/40 text-sm pt-12">
            Aucune categorie ne correspond a votre recherche.
          </p>
        )}
      </main>
    </>
  )
}
