'use client'

// Modal d'upgrade solo → cabinet, accessible depuis /profil pour les users
// orgless. Réutilise SiretCabinetForm puis appelle POST /api/auth/create-cabinet
// (la route détecte la session active et utilise auth.uid() côté serveur —
// pas besoin de transmettre user_id).

import { useState } from 'react'
import { X, Building2, Loader2 } from 'lucide-react'
import SiretCabinetForm, {
  CabinetData,
} from '@/components/auth/SiretCabinetForm'

interface CreateCabinetModalProps {
  onClose: () => void
  onCreated: () => void
}

export default function CreateCabinetModal({
  onClose,
  onCreated,
}: CreateCabinetModalProps) {
  const [cabinet, setCabinet] = useState<CabinetData>({
    name: '',
    siret: null,
    forme_juridique: null,
    adresse: null,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!cabinet.name.trim()) {
      setError('Le nom du cabinet est requis')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/create-cabinet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cabinet.name,
          siret: cabinet.siret,
          forme_juridique: cabinet.forme_juridique,
          adresse: cabinet.adresse,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'Erreur création cabinet')
        return
      }
      onCreated()
    } catch {
      setError('Erreur réseau. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2D1B96]/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-[#2D1B96]" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Créer mon cabinet</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            En créant votre cabinet, vous deviendrez titulaire et pourrez
            ensuite inviter vos collaborateurs et assistant·e·s.
          </p>

          <SiretCabinetForm
            value={cabinet}
            onChange={setCabinet}
            disabled={loading}
          />

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={loading || !cabinet.name.trim()}
            className="flex-1 py-3 bg-[#2D1B96] text-white rounded-lg font-medium hover:bg-[#231470] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Création...
              </>
            ) : (
              <>Créer mon cabinet</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
