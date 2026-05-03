'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  User,
  AlertCircle,
  AlertTriangle,
  Briefcase,
  Stethoscope,
} from 'lucide-react'
import Link from 'next/link'
import SiretCabinetForm, {
  CabinetData,
} from '@/components/auth/SiretCabinetForm'

type Mode = 'praticien_solo' | 'titulaire_cabinet'

const RPPS_RE = /^\d{11}$/
const RPPS_DEBOUNCE_MS = 500

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [rpps, setRpps] = useState('')
  const [rppsWarning, setRppsWarning] = useState<string | null>(null)
  const [isHealthProfessional, setIsHealthProfessional] = useState<boolean | null>(null)
  const [rgpdConsent, setRgpdConsent] = useState(false)
  const [mode, setMode] = useState<Mode>('praticien_solo')
  const [cabinet, setCabinet] = useState<CabinetData>({
    name: '',
    siret: null,
    forme_juridique: null,
    adresse: null,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const router = useRouter()
  const supabase = createClient()
  const rppsTimerRef = useRef<number | null>(null)

  const validatePassword = (pwd: string) => {
    const minLength = pwd.length >= 8
    const hasUppercase = /[A-Z]/.test(pwd)
    const hasLowercase = /[a-z]/.test(pwd)
    const hasNumber = /[0-9]/.test(pwd)
    return {
      minLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      isValid: minLength && hasUppercase && hasLowercase && hasNumber,
    }
  }

  const passwordValidation = validatePassword(password)

  // ─── Vérification RPPS non-bloquante (annuaire santé public) ─────────────
  useEffect(() => {
    setRppsWarning(null)
    if (rppsTimerRef.current) {
      window.clearTimeout(rppsTimerRef.current)
      rppsTimerRef.current = null
    }
    const trimmed = rpps.trim()
    if (!trimmed) return
    if (!RPPS_RE.test(trimmed)) {
      // 11 chiffres attendus pour un RPPS personne physique. Pas de warning
      // tant que la saisie est partielle ; warning seulement si format invalide
      // ET longueur >= 11.
      if (trimmed.length >= 11) {
        setRppsWarning('Format RPPS invalide (11 chiffres attendus).')
      }
      return
    }

    rppsTimerRef.current = window.setTimeout(async () => {
      // API publique annuaire santé. Si indisponible : ignorer silencieusement
      // (cf ticket §6 : pas de blocage signup).
      try {
        const res = await fetch(
          `https://annuaire.sante.fr/api/ps/${encodeURIComponent(trimmed)}`,
          { headers: { Accept: 'application/json' } }
        )
        if (!res.ok) return
        const json = await res.json().catch(() => null)
        if (!json) return
        // Le format de l'API peut varier. On cherche un libellé profession
        // ou code profession dans les champs courants.
        const flat = JSON.stringify(json).toLowerCase()
        const isDentiste =
          flat.includes('chirurgien-dentiste') ||
          flat.includes('chirurgien dentiste') ||
          flat.includes('"40"') // code profession 40 = chirurgien-dentiste
        if (!isDentiste) {
          setRppsWarning(
            "Ce numéro RPPS ne correspond pas à un chirurgien-dentiste — vous pouvez continuer."
          )
        }
      } catch {
        // Silence : pas de blocage signup si API indispo.
      }
    }, RPPS_DEBOUNCE_MS)

    return () => {
      if (rppsTimerRef.current) window.clearTimeout(rppsTimerRef.current)
    }
  }, [rpps])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (isHealthProfessional !== true) {
      setError('Vous devez confirmer être un professionnel de santé pour vous inscrire')
      setLoading(false)
      return
    }

    if (!passwordValidation.isValid) {
      setError('Le mot de passe ne respecte pas les critères de sécurité')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      setLoading(false)
      return
    }

    if (mode === 'titulaire_cabinet' && !cabinet.name.trim()) {
      setError('Le nom du cabinet est requis pour un titulaire')
      setLoading(false)
      return
    }

    if (rpps.trim() && !RPPS_RE.test(rpps.trim())) {
      setError('Le numéro RPPS doit comporter 11 chiffres')
      setLoading(false)
      return
    }

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            // RPPS persisté en raw_user_meta_data ; le trigger handle_new_user
            // peut le recopier dans user_profiles.rpps en V1.5. Pour V1 on
            // l'écrit directement après signup (cf. update plus bas).
            rpps: rpps.trim() || null,
          },
        },
      })

      if (signUpError) throw signUpError

      const newUserId = signUpData.user?.id ?? null

      // RPPS → user_profiles.rpps. Best-effort : si ça échoue, le signup
      // reste valide. Le trigger handle_new_user a déjà créé la ligne.
      // Note : RLS user_profiles ne laisse pas l'user pré-vérifié écrire,
      // donc on passe par signUp metadata uniquement (le trigger pourra
      // évoluer en V1.5 pour copier le RPPS dans user_profiles).
      // En V1, on n'écrit pas directement user_profiles.rpps depuis le client.

      // ─── Création cabinet si mode titulaire ────────────────────────────
      if (mode === 'titulaire_cabinet' && newUserId) {
        const res = await fetch('/api/auth/create-cabinet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: newUserId,
            name: cabinet.name,
            siret: cabinet.siret,
            forme_juridique: cabinet.forme_juridique,
            adresse: cabinet.adresse,
          }),
        })

        if (!res.ok) {
          // Le compte est créé mais la création cabinet a échoué.
          // On redirige quand même vers verify-email avec un flag pour
          // proposer la création depuis /profil après login.
          const json = await res.json().catch(() => ({}))
          console.error('create-cabinet failed:', json)
          router.push(
            `/verify-email?email=${encodeURIComponent(email)}&cabinet_pending=1`
          )
          return
        }
      }

      router.push(`/verify-email?email=${encodeURIComponent(email)}`)
    } catch (error: unknown) {
      console.error('Erreur inscription:', error)
      const message =
        error instanceof Error ? error.message : 'Une erreur est survenue'
      if (message === 'User already registered') {
        setError('Un compte existe déjà avec cet email')
      } else if (
        message.includes('duplicate key') ||
        message.includes('already exists')
      ) {
        setError('Un compte existe déjà avec cet email')
      } else if (message.includes('Database error')) {
        setError('Un compte existe déjà avec cet email. Essayez de vous connecter.')
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2D1B96] to-[#1a1060] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#2D1B96] mb-2">DentalLearn</h1>
          <p className="text-gray-600">Créez votre compte</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Prénom</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                  placeholder="Jean"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nom</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                  placeholder="Dupont"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="new-email"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                placeholder="votre@email.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {password && (
              <div className="mt-2 space-y-1 text-xs">
                <div className={`flex items-center gap-2 ${passwordValidation.minLength ? 'text-green-600' : 'text-gray-400'}`}>
                  <span>{passwordValidation.minLength ? '✓' : '○'}</span>
                  <span>Au moins 8 caractères</span>
                </div>
                <div className={`flex items-center gap-2 ${passwordValidation.hasUppercase ? 'text-green-600' : 'text-gray-400'}`}>
                  <span>{passwordValidation.hasUppercase ? '✓' : '○'}</span>
                  <span>Une majuscule</span>
                </div>
                <div className={`flex items-center gap-2 ${passwordValidation.hasLowercase ? 'text-green-600' : 'text-gray-400'}`}>
                  <span>{passwordValidation.hasLowercase ? '✓' : '○'}</span>
                  <span>Une minuscule</span>
                </div>
                <div className={`flex items-center gap-2 ${passwordValidation.hasNumber ? 'text-green-600' : 'text-gray-400'}`}>
                  <span>{passwordValidation.hasNumber ? '✓' : '○'}</span>
                  <span>Un chiffre</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Confirmer le mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="mt-1 text-xs text-red-500">Les mots de passe ne correspondent pas</p>
            )}
          </div>

          {/* RPPS optionnel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Numéro RPPS <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <div className="relative">
              <Stethoscope className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={rpps}
                onChange={(e) => setRpps(e.target.value.replace(/\D/g, '').slice(0, 11))}
                inputMode="numeric"
                autoComplete="off"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                placeholder="11 chiffres"
              />
            </div>
            {rppsWarning && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">{rppsWarning}</p>
              </div>
            )}
          </div>

          {/* Mode d'exercice */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            <p className="text-sm font-medium text-gray-700">Mode d&apos;exercice</p>
            <div className="space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'praticien_solo'}
                  onChange={() => setMode('praticien_solo')}
                  className="mt-1 w-4 h-4 text-[#2D1B96] focus:ring-[#2D1B96]"
                />
                <span className="text-sm text-gray-700">
                  <span className="font-semibold">Praticien individuel</span>
                  <span className="block text-xs text-gray-500">
                    Vous exercez seul, sans cabinet structuré dans DentalLearn.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'titulaire_cabinet'}
                  onChange={() => setMode('titulaire_cabinet')}
                  className="mt-1 w-4 h-4 text-[#2D1B96] focus:ring-[#2D1B96]"
                />
                <span className="text-sm text-gray-700">
                  <span className="font-semibold inline-flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5" />
                    Titulaire de cabinet
                  </span>
                  <span className="block text-xs text-gray-500">
                    Vous créez votre cabinet et pourrez inviter vos collaborateurs.
                  </span>
                </span>
              </label>
            </div>

            {mode === 'titulaire_cabinet' && (
              <div className="pt-3 border-t border-gray-200">
                <SiretCabinetForm
                  value={cabinet}
                  onChange={setCabinet}
                  disabled={loading}
                />
              </div>
            )}
          </div>

          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-3">Je confirme être professionnel de santé</p>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="healthProfessional"
                  checked={isHealthProfessional === true}
                  onChange={() => setIsHealthProfessional(true)}
                  className="w-4 h-4 text-[#2D1B96] focus:ring-[#2D1B96]"
                />
                <span className="text-sm text-gray-700">Oui</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="healthProfessional"
                  checked={isHealthProfessional === false}
                  onChange={() => setIsHealthProfessional(false)}
                  className="w-4 h-4 text-[#2D1B96] focus:ring-[#2D1B96]"
                />
                <span className="text-sm text-gray-700">Non</span>
              </label>
            </div>
            {isHealthProfessional === false && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">
                  L&apos;accès à DentalLearn est réservé aux professionnels de santé.
                </p>
              </div>
            )}
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={rgpdConsent}
              onChange={(e) => setRgpdConsent(e.target.checked)}
              required
              className="mt-1 w-4 h-4 text-[#2D1B96] focus:ring-[#2D1B96] rounded"
            />
            <span className="text-sm text-gray-700">
              J&apos;accepte la{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2D1B96] font-medium hover:underline"
              >
                politique de confidentialité
              </a>{' '}
              et les conditions d&apos;utilisation
            </span>
          </label>

          <button
            type="submit"
            disabled={
              loading ||
              !passwordValidation.isValid ||
              password !== confirmPassword ||
              isHealthProfessional !== true ||
              !rgpdConsent ||
              (mode === 'titulaire_cabinet' && !cabinet.name.trim())
            }
            className="w-full py-3 bg-[#2D1B96] text-white rounded-lg font-medium hover:bg-[#231470] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Inscription...
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                S&apos;inscrire
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Déjà un compte ?{' '}
            <Link href="/login" className="text-[#2D1B96] font-medium hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
