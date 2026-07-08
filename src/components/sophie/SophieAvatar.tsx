import Image from 'next/image'

interface SophieAvatarProps {
  size?: number
}

export default function SophieAvatar({ size = 48 }: SophieAvatarProps) {
  return (
    <div
      className="shrink-0 overflow-hidden rounded-full ring-2 ring-accent/40"
      style={{ width: size, height: size }}
    >
      <Image
        src="/images/sophie-avatar.webp"
        alt="Sophie"
        width={size}
        height={size}
        className="h-full w-full object-cover"
        priority
      />
    </div>
  )
}
