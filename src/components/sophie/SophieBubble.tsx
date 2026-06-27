import SophieAvatar from './SophieAvatar'

interface SophieBubbleProps {
  message: string
}

export default function SophieBubble({ message }: SophieBubbleProps) {
  return (
    <div className="flex items-start gap-3">
      <SophieAvatar size={40} />
      <div className="glass-card rounded-2xl rounded-tl-none px-4 py-3 text-sm text-white/90 transition-premium">
        {message}
      </div>
    </div>
  )
}
