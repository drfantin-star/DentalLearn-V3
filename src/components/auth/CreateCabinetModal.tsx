'use client'

// Modal d'upgrade solo → cabinet, accessible depuis /profil pour les users
// orgless. Réutilise SiretCabinetForm puis appelle POST /api/auth/create-cabinet
// (la route détecte la session active et utilise auth.uid() côté serveur —
// pas besoin de transmettre user_id).

import { useState } from 'react'
import { Building2, Loader2 } from 'lucide-react'
import SiretCabinetForm, {
  CabinetData,
} from '@/components/auth/SiretCabinetForm'
import { Modal } from '@/components/ui/Modal'

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
    <Modal
      open
      onClose={onClose}
      variant="dark"
      size="md"
      closeOnEsc={!loading}
      closeOnBackdrop={!loading}
    >
      <Modal.Header title="Créer mon cabinet" onClose={loading ? undefined : onClose}>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
      </Modal.Header>

      <Modal.Body className="space-y-4" scrollable={false}>
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
      </Modal.Body>

      <Modal.Footer>
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
          className="flex-1 py-3 bg-primary text-white rounded-lg font-medium hover:bg-[#231470] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
      </Modal.Footer>
    </Modal>
  )
}
