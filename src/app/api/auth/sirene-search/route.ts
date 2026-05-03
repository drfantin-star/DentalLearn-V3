// Proxy serveur vers l'API "recherche-entreprises" de gouv.fr (sans clé requise).
// Permet une autocomplétion sur le nom du cabinet OU sur le SIRET.
//
// Pourquoi un proxy : éviter d'exposer les requêtes directement depuis le
// client (CORS + future possibilité de rate-limiting / cache si dérive).
//
// Endpoint amont : https://recherche-entreprises.api.gouv.fr/search?q=...
// Doc : https://recherche-entreprises.api.gouv.fr/docs

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface SireneResult {
  siret: string
  nom: string
  forme_juridique: string | null
  adresse: string | null
  actif: boolean
}

interface GouvEtablissement {
  siret: string
  adresse?: string
  code_postal?: string
  libelle_commune?: string
  etat_administratif?: string
}

interface GouvUniteLegale {
  siren: string
  siege?: GouvEtablissement
  matching_etablissements?: GouvEtablissement[]
  nom_complet?: string
  nom_raison_sociale?: string
  nature_juridique?: string
  libelle_nature_juridique?: string
  etat_administratif?: string
}

interface GouvSearchResponse {
  results?: GouvUniteLegale[]
}

const UPSTREAM = 'https://recherche-entreprises.api.gouv.fr/search'
const TIMEOUT_MS = 5000
const MAX_RESULTS = 8

function pickEtablissement(u: GouvUniteLegale): GouvEtablissement | undefined {
  if (u.siege?.siret) return u.siege
  if (u.matching_etablissements && u.matching_etablissements.length > 0) {
    return u.matching_etablissements[0]
  }
  return undefined
}

function formatAdresse(e: GouvEtablissement | undefined): string | null {
  if (!e) return null
  const parts: string[] = []
  if (e.adresse) parts.push(e.adresse)
  const cpVille = [e.code_postal, e.libelle_commune].filter(Boolean).join(' ')
  if (cpVille) parts.push(cpVille)
  return parts.length > 0 ? parts.join(', ') : null
}

function mapResult(u: GouvUniteLegale): SireneResult | null {
  const etab = pickEtablissement(u)
  if (!etab?.siret) return null

  // L'établissement peut être actif/fermé indépendamment de l'unité légale.
  // On considère "actif" si aucun des deux n'est explicitement "F" (fermé/cessé).
  const actif =
    (etab.etat_administratif ?? 'A') !== 'F' &&
    (u.etat_administratif ?? 'A') !== 'C'

  return {
    siret: etab.siret,
    nom: u.nom_complet ?? u.nom_raison_sociale ?? '',
    forme_juridique: u.libelle_nature_juridique ?? null,
    adresse: formatAdresse(etab),
    actif,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const qRaw = (searchParams.get('q') ?? '').trim()

  if (qRaw.length < 3) {
    return NextResponse.json(
      { error: 'Requête trop courte (3 caractères minimum)' },
      { status: 400 }
    )
  }

  // Si l'input ressemble à un SIRET (14 chiffres), on cherche ce SIRET précis.
  // Sinon recherche full-text sur le nom.
  const isSiret = /^\d{14}$/.test(qRaw.replace(/\s+/g, ''))
  const params = new URLSearchParams({
    q: isSiret ? qRaw.replace(/\s+/g, '') : qRaw,
    per_page: String(MAX_RESULTS),
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${UPSTREAM}?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return NextResponse.json(
        { error: `API gouv.fr indisponible (${res.status})` },
        { status: 502 }
      )
    }

    const json = (await res.json()) as GouvSearchResponse
    const results: SireneResult[] = (json.results ?? [])
      .map(mapResult)
      .filter((r): r is SireneResult => r !== null)
      .slice(0, MAX_RESULTS)

    return NextResponse.json({ results })
  } catch (e) {
    clearTimeout(timeout)
    const aborted = e instanceof Error && e.name === 'AbortError'
    return NextResponse.json(
      {
        error: aborted
          ? 'Délai dépassé (API gouv.fr lente). Saisie manuelle possible.'
          : 'Erreur réseau API gouv.fr. Saisie manuelle possible.',
      },
      { status: 504 }
    )
  }
}
