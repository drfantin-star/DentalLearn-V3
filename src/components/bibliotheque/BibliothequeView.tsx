import Link from 'next/link'
import {
  ChevronLeft,
  ExternalLink,
  FileText,
  ChevronRight,
} from 'lucide-react'
import {
  AXE_GRADIENTS,
  BIBLIOTHEQUE_DEFAULT_SUBTITLES,
  type RessourceBibliotheque,
} from '@/lib/constants/bibliotheque'

interface BibliothequeViewProps {
  axe: 1 | 3 | 4
  ressources: RessourceBibliotheque[]
  backHref: string // page d'axe parente (ex. /patient)
  title?: string // défaut : "Bibliothèque de ressources"
  subtitle?: string // défaut adapté à l'axe
}

// Regroupe les ressources par catégorie en préservant l'ordre d'apparition.
function groupByCategorie(
  ressources: RessourceBibliotheque[],
): { categorie: string; items: RessourceBibliotheque[] }[] {
  const order: string[] = []
  const map = new Map<string, RessourceBibliotheque[]>()
  for (const r of ressources) {
    const cat = r.categorie ?? 'Autres ressources'
    if (!map.has(cat)) {
      map.set(cat, [])
      order.push(cat)
    }
    map.get(cat)!.push(r)
  }
  return order.map((categorie) => ({ categorie, items: map.get(categorie)! }))
}

function RessourceCard({
  ressource,
  axe,
}: {
  ressource: RessourceBibliotheque
  axe: 1 | 3 | 4
}) {
  const isExternal = ressource.type === 'external'
  const Icon = isExternal ? ExternalLink : FileText
  const accent = AXE_GRADIENTS[axe].from

  const inner = (
    <>
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${accent}22` }}
      >
        <Icon size={18} style={{ color: accent }} aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold leading-snug text-white">
            {ressource.titre}
          </h3>
          {isExternal ? (
            <span className="flex-shrink-0 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/70">
              Source : {ressource.source}
            </span>
          ) : (
            <span
              className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
              style={{ backgroundColor: `${accent}33`, color: accent }}
            >
              {ressource.source}
            </span>
          )}
        </div>
        {ressource.description && (
          <p className="mt-1 text-xs leading-relaxed text-gray-400">
            {ressource.description}
          </p>
        )}
      </div>

      <ChevronRight
        size={18}
        aria-hidden="true"
        className="mt-1 flex-shrink-0 self-start text-gray-500 transition-colors group-hover:text-gray-300"
      />
    </>
  )

  const cardClass =
    'group flex items-start gap-3 rounded-2xl border border-gray-800 bg-[#1a1a1a] p-3.5 transition-colors hover:border-gray-700 hover:bg-[#202020] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40'

  if (isExternal) {
    return (
      <a
        href={ressource.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${ressource.titre} (lien externe vers ${ressource.source}, nouvelle fenêtre)`}
        className={cardClass}
      >
        {inner}
      </a>
    )
  }

  return (
    <Link
      href={ressource.url}
      aria-label={ressource.titre}
      className={cardClass}
    >
      {inner}
    </Link>
  )
}

/**
 * Vue générique de la bibliothèque, paramétrée par axe. Une seule
 * implémentation montée sur /formation/bibliotheque, /patient/bibliotheque
 * et /sante/bibliotheque — seules les données changent.
 */
export default function BibliothequeView({
  axe,
  ressources,
  backHref,
  title = 'Bibliothèque de ressources',
  subtitle,
}: BibliothequeViewProps) {
  const gradient = AXE_GRADIENTS[axe]
  const resolvedSubtitle = subtitle ?? BIBLIOTHEQUE_DEFAULT_SUBTITLES[axe]
  const groups = groupByCategorie(ressources)

  return (
    <>
      <header
        className="px-4 py-4"
        style={{
          background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
        }}
      >
        <div className="mb-1 flex items-center gap-3">
          <Link
            href={backHref}
            aria-label="Retour"
            className="-ml-2 rounded-xl p-2 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ChevronLeft size={20} className="text-white" />
          </Link>
          <h1 className="text-2xl font-black text-white">{title}</h1>
        </div>
        <p className="mt-1 text-sm font-semibold leading-relaxed text-white/80">
          {resolvedSubtitle}
        </p>
      </header>

      <main
        className="mx-auto min-h-screen max-w-lg px-4 py-6 md:max-w-2xl md:px-6 lg:max-w-4xl lg:px-8 xl:max-w-6xl"
        style={{ background: '#0F0F0F' }}
      >
        {groups.length === 0 ? (
          <p className="rounded-2xl border border-gray-800 bg-[#1a1a1a] p-6 text-center text-sm text-gray-400">
            Aucune ressource disponible pour le moment.
          </p>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.categorie}>
                <h2 className="mb-3 text-base font-black text-white">
                  {group.categorie}
                </h2>
                <div className="space-y-3">
                  {group.items.map((ressource) => (
                    <RessourceCard
                      key={ressource.id}
                      ressource={ressource}
                      axe={axe}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
