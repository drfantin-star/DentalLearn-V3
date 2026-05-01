import Link from 'next/link'
import { Newspaper, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
        <Newspaper className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Synthèse introuvable</h1>
        <p className="text-gray-600 mb-6">
          Cette synthèse n'existe pas ou a été supprimée.
        </p>
        <Link
          href="/admin/news"
          className="inline-flex items-center gap-2 bg-[#2D1B96] hover:bg-[#231575] text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à la liste
        </Link>
      </div>
    </div>
  )
}
