import React from 'react'
import { GraduationCap } from 'lucide-react'
import { axisIcons, axisBgColors, axisColors } from '@/lib/constants/axis'
import type { AxisWithProgress } from '@/lib/hooks/useAxes'

interface GlobalProgressBarsProps {
  axes: AxisWithProgress[]
}

export default function GlobalProgressBars({ axes }: GlobalProgressBarsProps) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="space-y-3">
        {axes.map((axis) => {
          const Icon = axisIcons[axis.id] || GraduationCap
          const bgColor = axisBgColors[axis.id] || 'bg-gray-50'
          const color = axisColors[axis.id] || axis.color
          const percent = Math.round((axis.progressFilled / 4) * 100)

          return (
            <div key={axis.id} className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${bgColor}`}
                style={{ color }}
              >
                <Icon size={16} />
              </div>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
              <span className="text-[10px] font-bold text-gray-400 w-8 text-right">
                {percent}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
