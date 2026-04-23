import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { CheckCircle2, XCircle, Shield, Calendar, User, FileText } from 'lucide-react'

// Route publique — pas de auth middleware
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface VerifyResult {
  participant_nom: string
  participant_rpps: string
  formation_titre: string
  date_emission: string
  organisme: string
  qualiopi: string
  odpc: string
  is_valid: boolean
}

async function verifyAttestation(code: string): Promise<VerifyResult | null> {
  // Client anonyme (pas de session user requis)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase.rpc('verify_attestation_public', {
    p_verification_code: code,
  })

  if (error) {
    console.error('Erreur verify RPC:', error)
    return null
  }

  // La RPC retourne un SETOF, donc data est un tableau
  if (!data || data.length === 0) return null
  return data[0] as VerifyResult
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const result = await verifyAttestation(code.toUpperCase())
  const isValid = result !== null

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#0F7B6C] mb-3">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Vérification d'attestation</h1>
          <p className="text-sm text-gray-500 mt-1">Dentalschool — EROJU SAS</p>
        </div>

        {/* Résultat */}
        {isValid ? (
          <div className="bg-white rounded-3xl shadow-lg border border-green-100 overflow-hidden">
            {/* Badge validation */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-6 py-4 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-white flex-shrink-0" />
              <div>
                <p className="text-white font-bold">Attestation authentique</p>
                <p className="text-green-50 text-xs">Document vérifié dans notre système</p>
              </div>
            </div>

            {/* Détails */}
            <div className="p-6 space-y-4">
              <InfoRow
                icon={<User className="w-4 h-4" />}
                label="Titulaire"
                value={result.participant_nom}
              />
              <InfoRow
                icon={<Shield className="w-4 h-4" />}
                label="N° RPPS"
                value={result.participant_rpps}
                mono
              />
              <InfoRow
                icon={<FileText className="w-4 h-4" />}
                label="Formation"
                value={result.formation_titre}
              />
              <InfoRow
                icon={<Calendar className="w-4 h-4" />}
                label="Émise le"
                value={formatDate(result.date_emission)}
              />

              <div className="pt-4 border-t border-gray-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Organisme</span>
                  <span className="text-gray-900 font-medium text-right">{result.organisme}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Qualiopi</span>
                  <span className="font-mono text-gray-900">{result.qualiopi}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">N° ODPC</span>
                  <span className="font-mono text-gray-900">{result.odpc}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Code de vérification</span>
                  <span className="font-mono font-semibold text-[#0F7B6C]">{code.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-lg border border-red-100 overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-rose-500 px-6 py-4 flex items-center gap-3">
              <XCircle className="w-6 h-6 text-white flex-shrink-0" />
              <div>
                <p className="text-white font-bold">Attestation introuvable</p>
                <p className="text-red-50 text-xs">Code non reconnu</p>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-700 mb-3">
                Le code <span className="font-mono font-semibold">{code.toUpperCase()}</span> ne
                correspond à aucune attestation émise par Dentalschool.
              </p>
              <p className="text-xs text-gray-500">
                Vérifiez la saisie. Si le problème persiste, contactez{' '}
                <a href="mailto:info@dentalschool.fr" className="text-[#0F7B6C] underline">
                  info@dentalschool.fr
                </a>
              </p>
            </div>
          </div>
        )}

        {/* Footer mentions légales */}
        <div className="mt-6 text-center text-xs text-gray-400 space-y-1">
          <p>EROJU SAS — 76 Bd Meusnier de Querlon, 44000 Nantes</p>
          <p>SIRET 95271921900018 — APE 8559A</p>
          <p>
            <Link href="https://www.dentalschool.fr" className="text-[#0F7B6C] hover:underline">
              www.dentalschool.fr
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

// Composant helper pour une ligne d'info
function InfoRow({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-[#0F7B6C]/10 flex items-center justify-center flex-shrink-0 text-[#0F7B6C]">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p
          className={`text-sm text-gray-900 font-medium break-words ${
            mono ? 'font-mono' : ''
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

// Métadonnées SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  return {
    title: `Vérification d'attestation ${code.toUpperCase()} | Dentalschool`,
    description: 'Vérifiez l\'authenticité d\'une attestation de formation Dentalschool.',
    robots: { index: false, follow: false },  // pas d'indexation Google
  }
}
