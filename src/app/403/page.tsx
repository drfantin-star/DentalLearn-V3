import Link from 'next/link'
import { Shield } from 'lucide-react'

export const metadata = {
  title: 'Accès interdit · DentalLearn',
}

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
        <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Accès interdit</h1>
        <p className="text-gray-600 mb-6">
          Vous n'avez pas les droits nécessaires pour accéder à cette page.
        </p>
        <Link
          href="/"
          className="inline-block bg-[#2D1B96] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#231575] transition-colors"
        >
          Retour à l'accueil
        </Link>
      </div>
    </div>
  )
}
