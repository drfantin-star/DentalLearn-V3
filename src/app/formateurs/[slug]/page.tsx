import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Linkedin, Instagram } from 'lucide-react'
import UpcomingEvents from '@/components/UpcomingEvents'
import UpcomingSessions from '@/components/UpcomingSessions'
import { FollowButton } from '@/components/formateur/FollowButton'

export const dynamic = 'force-dynamic'

interface FormateurPublicProfil {
  id: string
  user_id: string
  slug: string
  display_name: string
  bio_long: string | null
  expertise_tags: string[] | null
  annees_experience: number | null
  ville: string | null
  cabinet_nom: string | null
  linkedin_url: string | null
  instagram_url: string | null
  photo_pro_url: string | null
  is_published: boolean
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

export default async function FormateurPublicPage({
  params,
}: {
  params: { slug: string }
}) {
  const supabase = await createClient()

  // Vérification session — redirect /login si non connecté
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/formateurs/${params.slug}`)
  }

  // Fetch du profil public (RLS is_published=true filtre les profils non publiés)
  const { data: profil, error } = await supabase
    .from('formateur_profiles')
    .select(
      'id, user_id, slug, display_name, bio_long, expertise_tags, annees_experience, ville, cabinet_nom, linkedin_url, instagram_url, photo_pro_url, is_published'
    )
    .eq('slug', params.slug)
    .eq('is_published', true)
    .maybeSingle()

  if (error || !profil) {
    notFound()
  }

  const p = profil as FormateurPublicProfil

  // Fetch follow state + followers count in parallel (server-side)
  const [followRow, countRow] = await Promise.all([
    supabase
      .from('formateur_followers')
      .select('id')
      .eq('user_id', user.id)
      .eq('formateur_user_id', p.user_id)
      .maybeSingle(),
    supabase
      .from('formateur_followers')
      .select('id', { count: 'exact', head: true })
      .eq('formateur_user_id', p.user_id),
  ])

  const initialFollowing = !!followRow.data
  const initialCount = countRow.count ?? 0

  return (
    <main className="min-h-screen" style={{ background: '#111' }}>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-primary flex items-center justify-center shrink-0">
            {p.photo_pro_url ? (
              <img
                src={p.photo_pro_url}
                alt={p.display_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-white text-xl font-bold">{getInitials(p.display_name)}</span>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[#e5e5e5]">{p.display_name}</h1>
            {(p.ville || p.cabinet_nom) && (
              <p className="text-sm text-[#9ca3af] mt-0.5">
                {[p.cabinet_nom, p.ville].filter(Boolean).join(' · ')}
              </p>
            )}
            {p.annees_experience != null && (
              <p className="text-xs text-[#6b7280] mt-0.5">
                {p.annees_experience} an{p.annees_experience > 1 ? 's' : ''} d'expérience
              </p>
            )}
          </div>
          {/* Bouton Suivre — ne pas afficher si l'utilisateur est le formateur */}
          {user.id !== p.user_id && (
            <FollowButton
              slug={p.slug}
              initialFollowing={initialFollowing}
              initialCount={initialCount}
            />
          )}
        </div>

        {/* ── Bio ──────────────────────────────────────────────────────── */}
        {p.bio_long && (
          <section
            className="rounded-2xl p-5"
            style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a' }}
          >
            <h2 className="text-sm font-bold text-[#e5e5e5] mb-3">À propos</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed whitespace-pre-wrap">
              {p.bio_long}
            </p>
          </section>
        )}

        {/* ── Spécialités ──────────────────────────────────────────────── */}
        {p.expertise_tags && p.expertise_tags.length > 0 && (
          <section
            className="rounded-2xl p-5"
            style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a' }}
          >
            <h2 className="text-sm font-bold text-[#e5e5e5] mb-3">Spécialités</h2>
            <div className="flex flex-wrap gap-2">
              {p.expertise_tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-medium px-3 py-1 rounded-full"
                  style={{ background: '#1e1535', color: '#a78bfa' }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── Réseaux sociaux ──────────────────────────────────────────── */}
        {(p.linkedin_url || p.instagram_url) && (
          <section
            className="rounded-2xl p-5"
            style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a' }}
          >
            <h2 className="text-sm font-bold text-[#e5e5e5] mb-3">Réseaux</h2>
            <div className="flex gap-4">
              {p.linkedin_url && (
                <a
                  href={p.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#a78bfa] hover:text-[#c4b5fd] transition-colors font-medium"
                >
                  <Linkedin size={16} />
                  LinkedIn
                </a>
              )}
              {p.instagram_url && (
                <a
                  href={p.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#a78bfa] hover:text-[#c4b5fd] transition-colors font-medium"
                >
                  <Instagram size={16} />
                  Instagram
                </a>
              )}
            </div>
          </section>
        )}

        {/* ── Événements présentiels ───────────────────────────────────── */}
        <UpcomingEvents formateurUserId={p.user_id} />

        {/* ── Masterclass à venir ──────────────────────────────────────── */}
        <UpcomingSessions formateurUserId={p.user_id} />

      </div>
    </main>
  )
}
