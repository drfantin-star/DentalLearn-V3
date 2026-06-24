'use client'

import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CATEGORIES } from '@/lib/supabase/types'

interface CategoryCarouselProps {
  categories: typeof CATEGORIES
  scrollRef: React.RefObject<HTMLDivElement>
}

export default function CategoryCarousel({ categories, scrollRef }: CategoryCarouselProps) {
  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' })
  }

  return (
    <div className="-mx-4">
      <div className="py-2 relative" style={{ paddingLeft: '16px', paddingRight: '0' }}>
        <button
          onClick={() => scroll('left')}
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-[#242424] shadow-md items-center justify-center text-gray-300 hover:bg-gray-50"
        >
          <ChevronLeft size={18} />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 snap-x snap-mandatory pr-4"
        >
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                const from = cat.type === 'axe3'
                  ? '/patient'
                  : cat.type === 'axe4'
                  ? '/sante'
                  : '/formation'
                window.location.href = `/formation/${cat.id}?from=${from}`
              }}
              className="flex-shrink-0 snap-start rounded-2xl overflow-hidden"
              style={{
                width: 'calc(50vw - 24px)',
                maxWidth: '220px',
                minWidth: '148px',
                aspectRatio: '3/2',
                position: 'relative',
                border: 'none',
                flexShrink: 0,
              }}
            >
              {cat.labelImageUrl ? (
                <img
                  src={cat.labelImageUrl}
                  alt={cat.name}
                  className="w-full h-full object-cover absolute inset-0"
                />
              ) : (
                <div
                  className="w-full h-full absolute inset-0"
                  style={{ background: `linear-gradient(135deg, ${cat.gradient.from}, ${cat.gradient.to})` }}
                />
              )}
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)' }}
              />
              <span
                className="absolute font-bold text-white leading-tight"
                style={{
                  bottom: '10px',
                  left: '10px',
                  fontSize: '15px',
                  textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                  maxWidth: 'calc(100% - 20px)',
                }}
              >
                {cat.name}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => scroll('right')}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-[#242424] shadow-md items-center justify-center text-gray-300 hover:bg-gray-50"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
