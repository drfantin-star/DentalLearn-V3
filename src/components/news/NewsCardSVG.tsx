'use client'

import React from 'react'

export const SPECIALITE_COLORS: Record<string, string> = {
  // Alignés palette Certily (Option A — 03/07/2026)
  'dent-resto': '#F59E0B',  // amber  — Dentisterie Restauratrice
  'paro':       '#EC4899',  // rose   — Parodontologie
  'implanto':   '#10B981',  // vert   — Implantologie
  'chir-orale': '#EF4444',  // rouge  — Chirurgie Orale
  'endo':       '#6366F1',  // indigo — Endodontie
  'proth':      '#F97316',  // orange — Prothèse
  // Couleurs non utilisées ailleurs dans la palette
  'odf':        '#8B5CF6',  // violet
  'occluso':    '#0F7B6C',  // teal Axe 2
  'sante-pub':  '#155E75',  // cyan foncé
  'pedo':       '#1E2A9A',  // bleu Klein
  'gero':       '#A78BFA',  // violet clair
  'actu-pro':   '#0F7B6C',  // teal Axe 2 (actu pro = pratiques)
}
export const NEWS_DEFAULT_COLOR = '#1A1A2E'
const DEFAULT_COLOR = NEWS_DEFAULT_COLOR

interface Props {
  specialite: string | null
  display_title: string
  className?: string
}

export default function NewsCardSVG({ specialite, display_title, className }: Props) {
  const bg = (specialite && SPECIALITE_COLORS[specialite]) || DEFAULT_COLOR

  return (
    <svg
      viewBox="0 0 280 160"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={display_title}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="news-card-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="280" height="160" fill={bg} />

      <g transform="translate(120, 35)">
        <path
          d="M12 2C8 2 5 5 5 9c0 2 .5 3.5 1 5l1 8h2l1-5h4l1 5h2l1-8c.5-1.5 1-3 1-5 0-4-3-7-7-7z"
          fill="white"
          opacity="0.3"
          transform="scale(1.667)"
        />
      </g>

      <rect x="0" y="0" width="280" height="160" fill="url(#news-card-gradient)" />
    </svg>
  )
}
