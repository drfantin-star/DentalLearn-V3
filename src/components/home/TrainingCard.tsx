import React from 'react'
import { GraduationCap, CheckCircle2, Sparkles } from 'lucide-react'
import { axisIcons, axisBgColors } from '@/lib/constants/axis'
import type { AxisWithProgress } from '@/lib/hooks/useAxes'

interface TrainingCardProps {
  axis: AxisWithProgress
  onStart: (axis: AxisWithProgress) => void
}

export default function TrainingCard({ axis, onStart }: TrainingCardProps) {
  const Icon = axisIcons[axis.id] || GraduationCap
  const bgColor = axisBgColors[axis.id] || 'bg-gray-50'

  return (
    <button
      onClick={() => !axis.dailyDone && onStart(axis)}
      disabled={axis.dailyDone}
      className={`w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left transition-all ${
        axis.dailyDone
          ? 'opacity-75'
          : 'hover:shadow-md hover:scale-[1.02] active:scale-[0.98]'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${bgColor}`}
          style={{ color: axis.color }}
        >
          <Icon size={20} />
        </div>
        {axis.dailyDone ? (
          <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full">
            <CheckCircle2 size={14} />
            <span className="text-[10px] font-bold">Fait</span>
          </div>
        ) : (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-full animate-pulse"
            style={{
              backgroundColor: `${axis.color}15`,
              color: axis.color,
            }}
          >
            <Sparkles size={12} />
            <span className="text-[10px] font-bold">+1 pt</span>
          </div>
        )}
      </div>
      <h3 className="font-bold text-gray-900 text-sm mb-1">
        {axis.short_name}
      </h3>
      <p className="text-[11px] text-gray-400">{axis.name}</p>
      <div className="mt-3 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: axis.dailyDone ? '100%' : '0%',
            backgroundColor: axis.color,
          }}
        />
      </div>
    </button>
  )
}
