import type { CSSProperties, ReactNode } from 'react'

/**
 * Conteneur des outils « à thème clair » de la Boîte à outils.
 *
 * Cause racine : globals.css applique `color-scheme: dark` sur html/body
 * (src/app/globals.css). Le navigateur peint alors les contrôles natifs
 * (input, textarea, select, sélecteur de date) avec l'apparence sombre —
 * fond foncé + texte/icônes clairs — ce qui rend illisible un module à fond
 * clair comme le Bilan parodontal.
 *
 * Correctif structurel : on rétablit `color-scheme: light` sur le conteneur du
 * module. `color-scheme` étant une propriété héritée, elle couvre tous les
 * champs descendants d'un coup, sans surcharge champ par champ. C'est le même
 * pattern que src/app/admin/layout.tsx et il ne touche pas au thème sombre du
 * reste de Certily (le style est scopé à ce sous-arbre).
 *
 * À réutiliser tel quel pour les prochains outils à thème clair (DUERP,
 * entretien professionnel, bilan érosions…).
 */
export default function LightToolSurface({
  children,
  className,
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div className={className} style={{ colorScheme: 'light', ...style }}>
      {children}
    </div>
  )
}
