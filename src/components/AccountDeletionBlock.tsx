'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ShieldAlert, AlertCircle } from 'lucide-react'
import { useSignOut } from '@/lib/hooks/useSignOut'

/**
 * Ecran plein bloquant affiche a la reconnexion tant que le compte a une
 * demande de suppression en attente (user_profiles.deletion_requested_at).
 *
 * Seul garde-fou du praticien qui se ravise : la reactivation remet
 * deletion_requested_at a NULL cote serveur (DELETE /api/user/delete). On ne
 * debloque l'UI qu'apres confirmation du succes (router.refresh -> le layout
 * relit la colonne et la trouve NULL). En cas d'echec, l'ecran reste bloquant
 * et affiche l'erreur : jamais de faux succes.
 */
export default function AccountDeletionBlock({
  deletionRequestedAt,
}: {
  deletionRequestedAt: string
}) {
  const router = useRouter()
  const signOut = useSignOut()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const purgeLabel = new Date(
    new Date(deletionRequestedAt).getTime() + 30 * 24 * 60 * 60 * 1000
  ).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  const handleReactivate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/user/delete', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'La reactivation a echoue. Veuillez reessayer.')
      }
      // Succes confirme cote serveur : on relit l'etat. Le layout, voyant
      // deletion_requested_at NULL, rendra l'application normalement.
      // Pas de setLoading(false) ici : on reste en attente du re-render.
      router.refresh()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'La reactivation a echoue. Veuillez reessayer.'
      setError(message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950 p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/15">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-white">Suppression de compte en cours</h1>
          <p className="text-sm text-white/60">
            Votre compte sera supprimé le{' '}
            <span className="font-semibold text-white">{purgeLabel}</span>.
          </p>
          <p className="text-sm text-white/60">
            Vous pouvez encore annuler et retrouver l&apos;accès à votre compte.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-left">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleReactivate}
            disabled={loading}
            className="w-full py-3 bg-primary text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Réactiver mon compte
          </button>

          <button
            onClick={() => { void signOut() }}
            disabled={loading}
            className="w-full py-3 text-sm font-medium text-white/60 hover:text-white rounded-xl transition-premium disabled:opacity-50"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  )
}
