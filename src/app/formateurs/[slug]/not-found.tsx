import Link from 'next/link'
import { UserX } from 'lucide-react'

export default function FormateurNotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: '#111' }}>
      <div
        className="max-w-sm w-full rounded-2xl p-8 text-center"
        style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a' }}
      >
        <UserX className="w-12 h-12 text-neutral-500 mx-auto mb-4" />
        <h1 className="text-lg font-bold text-neutral-100 mb-2">Profil introuvable</h1>
        <p className="text-sm text-neutral-400 mb-6">
          Ce profil formateur n'existe pas ou n'est pas publié pour le moment.
        </p>
        <Link
          href="/"
          className="inline-block bg-primary text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary-hover transition-colors"
        >
          Retour à l'accueil
        </Link>
      </div>
    </main>
  )
}
