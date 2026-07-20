'use client'

// Carte QR desktop → https://app.certily.fr. La valeur de Certily est mobile :
// sur desktop on ne demande jamais la permission push (un refus y est
// définitif et sans intérêt), on invite à ouvrir l'app sur le téléphone.
//
// Le QR est un asset SVG statique commité (public/images/qr-app-certily.svg,
// noir sur blanc, correction M) — aucune génération dynamique, aucune lib.
// JAMAIS affiché en mobile : le montage est desktop-only côté appelant.

interface QrAppCardProps {
  className?: string
  caption?: string
}

export default function QrAppCard({ className = '', caption }: QrAppCardProps) {
  return (
    <div
      className={`glass-card rounded-2xl border border-white/10 p-4 text-center ${className}`}
    >
      <p className="mb-1 text-sm font-semibold text-white">
        Continue sur ton téléphone
      </p>
      <p className="mb-3 text-xs text-white/55">
        {caption ?? 'Scanne pour recevoir tes rappels au bon endroit.'}
      </p>
      <div className="mx-auto w-fit rounded-xl bg-white p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/qr-app-certily.svg"
          alt="QR code vers app.certily.fr"
          width={128}
          height={128}
          className="h-32 w-32"
        />
      </div>
    </div>
  )
}
