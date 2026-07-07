import Link from 'next/link'
import Image from 'next/image'
import { AXE_COLORS } from '@/lib/cp/axeColors'

interface ExploreCard {
  href: string
  title: string
  subtitle: string
  accent: string
  image: string
}

const EXPLORE_CARDS: ExploreCard[] = [
  {
    href: '/formation',
    title: 'Formations',
    subtitle: 'Axes 1 & 2',
    accent: AXE_COLORS[1].hex,
    image: '/explore/explore-formation.webp',
  },
  {
    href: '/patient',
    title: 'Patient',
    subtitle: 'Axe 3',
    accent: AXE_COLORS[3].dark,
    image: '/explore/explore-patient.webp',
  },
  {
    href: '/sante',
    title: 'Sante',
    subtitle: 'Axe 4',
    accent: AXE_COLORS[4].hex,
    image: '/explore/explore-sante.webp',
  },
]

export default function ExploreRow() {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {EXPLORE_CARDS.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="relative flex min-h-[104px] flex-col items-center justify-center gap-1.5
                     overflow-hidden rounded-2xl border border-white/[0.07] bg-[#1a1a1a]
                     px-2 py-3 text-center transition-transform hover:scale-[1.02]"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-16"
            style={{
              background: `radial-gradient(ellipse at top, ${card.accent}33, transparent 70%)`,
            }}
          />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-[3px]"
            style={{ background: card.accent }}
          />
          <Image
            src={card.image}
            alt=""
            width={80}
            height={40}
            className="relative h-10 w-auto object-contain"
          />
          <div className="relative">
            <p className="text-sm font-bold text-white">{card.title}</p>
            <p className="text-[11px] text-white/50">{card.subtitle}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}
