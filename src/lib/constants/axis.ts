import {
  GraduationCap,
  ShieldCheck,
  HeartHandshake,
  HeartPulse,
} from 'lucide-react'
import type React from 'react'

// Mapping icône par axe CP
export const axisIcons: Record<number, React.ElementType> = {
  1: GraduationCap,
  2: ShieldCheck,
  3: HeartHandshake,
  4: HeartPulse,
}

// Fond léger par axe (Tailwind class)
export const axisBgColors: Record<number, string> = {
  1: 'bg-violet-50',
  2: 'bg-teal-50',
  3: 'bg-amber-50',
  4: 'bg-emerald-50',
}

// Couleur principale par axe (hex)
export const axisColors: Record<number, string> = {
  1: '#8B5CF6',
  2: '#00D1C1',
  3: '#F59E0B',
  4: '#10B981',
}
