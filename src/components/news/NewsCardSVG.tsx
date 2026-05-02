'use client'

import React from 'react'

const SPECIALITE_COLORS: Record<string, string> = {
  'dent-resto': '#2A6EBB',
  'paro':       '#2E7D32',
  'implanto':   '#6A1B9A',
  'chir-orale': '#C62828',
  'odf':        '#E65100',
  'endo':       '#00695C',
  'occluso':    '#AD1457',
  'proth':      '#4527A0',
  'sante-pub':  '#00838F',
  'pedo':       '#F9A825',
  'gero':       '#5D4037',
  'actu-pro':   '#37474F',
}
const DEFAULT_COLOR = '#1A1A2E'

interface Props {
  specialite: string | null
  display_title: string
  className?: string
}

export default function NewsCardSVG({ specialite, display_title, className }: Props) {
  const bg = (specialite && SPECIALITE_COLORS[specialite]) || DEFAULT_COLOR
  const specialiteLabel = specialite ?? ''

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

      {specialiteLabel ? (
        <g>
          <rect
            x="10"
            y="10"
            rx="10"
            ry="10"
            width={Math.min(90, 16 + specialiteLabel.length * 6)}
            height="20"
            fill="white"
            fillOpacity="0.2"
          />
          <text
            x="18"
            y="24"
            fill="white"
            fontSize="10"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontWeight="500"
          >
            {specialiteLabel}
          </text>
        </g>
      ) : null}
    </svg>
  )
}
