import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Verrou editorial cote chaine episodes / journal audio.
//
// Regle produit (chantier 23/07/2026) : un episode news contenant AU MOINS une
// synthese non diffusable ne doit pas etre diffuse cote praticien. Une synthese
// est diffusable si status='active' ET is_editorially_validated=true.
//
// Deux tables de liaison coexistent :
//   - news_episode_items      -> episodes digest / insight (colonne synthesis_id)
//   - news_episode_syntheses  -> journal hebdo            (colonne synthesis_id)
// On inspecte les deux pour couvrir tous les types d'episodes.
// ---------------------------------------------------------------------------

interface EpisodeSynthesisLink {
  episode_id: string
  synthesis_id: string
}

/**
 * Retourne l'ensemble des `episode_id` (parmi ceux fournis) qui contiennent au
 * moins une synthese non diffusable. Un episode absent de ce set est
 * entierement valide (toutes ses syntheses sont actives et validees), ou n'a
 * aucune synthese liee.
 *
 * Prend un client admin (bypass RLS, meme pattern que les routes news). Ne
 * lit que des colonnes sures sur news_syntheses (id, status, flag).
 */
export async function getInvalidEpisodeIds(
  admin: SupabaseClient,
  episodeIds: string[],
): Promise<Set<string>> {
  const invalid = new Set<string>()
  if (episodeIds.length === 0) return invalid

  const [itemsRes, synsRes] = await Promise.all([
    admin
      .from('news_episode_items')
      .select('episode_id, synthesis_id')
      .in('episode_id', episodeIds),
    admin
      .from('news_episode_syntheses')
      .select('episode_id, synthesis_id')
      .in('episode_id', episodeIds),
  ])

  const links: EpisodeSynthesisLink[] = [
    ...((itemsRes.data ?? []) as Record<string, unknown>[]),
    ...((synsRes.data ?? []) as Record<string, unknown>[]),
  ]
    .map((r) => ({
      episode_id: r.episode_id as string,
      synthesis_id: r.synthesis_id as string,
    }))
    .filter((l) => l.episode_id && l.synthesis_id)

  const synthesisIds = Array.from(new Set(links.map((l) => l.synthesis_id)))
  if (synthesisIds.length === 0) return invalid

  const { data: synRows } = await admin
    .from('news_syntheses')
    .select('id, status, is_editorially_validated')
    .in('id', synthesisIds)

  const validSynthesisIds = new Set<string>()
  for (const s of (synRows ?? []) as Record<string, unknown>[]) {
    if (s.status === 'active' && s.is_editorially_validated === true) {
      validSynthesisIds.add(s.id as string)
    }
  }

  // Un lien vers une synthese non validee (ou introuvable = supprimee) invalide
  // tout l'episode.
  for (const l of links) {
    if (!validSynthesisIds.has(l.synthesis_id)) {
      invalid.add(l.episode_id)
    }
  }

  return invalid
}
