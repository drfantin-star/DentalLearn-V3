import React from 'react'

interface PageContainerProps {
  children: React.ReactNode
  className?: string
}

// Conteneur de page (PR2 — contenu pleine largeur desktop).
//
// Sous lg : largeurs mobiles conservees a l'identique (max-w-lg puis
// md:max-w-2xl, px-4 md:px-6) — aucun changement de rendu < 1024px.
// A partir de lg : le contenu devient fluide, plafonne a 1500px et centre
// dans la zone de contenu (a droite de la SideNav), avec un padding desktop
// genereux (lg:px-8). Arbitrage 2A : jamais 100 % fluide, toujours un plafond.
//
// `className` est appende pour les espacements/verticaux propres a chaque page
// (py-*, space-y-*, etc.). Ne pas y remettre de max-w-* qui casserait le
// plafond desktop.
export default function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <div
      className={`w-full max-w-lg md:max-w-2xl lg:max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 ${className}`}
    >
      {children}
    </div>
  )
}
