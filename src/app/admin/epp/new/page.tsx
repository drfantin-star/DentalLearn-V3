'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Save } from 'lucide-react';

const themeOptions = [
  { value: 'esthetique', label: 'Esthétique Dentaire' },
  { value: 'restauratrice', label: 'Dentisterie Restauratrice' },
  { value: 'endodontie', label: 'Endodontie' },
  { value: 'chirurgie', label: 'Chirurgie Orale' },
  { value: 'implant', label: 'Implantologie' },
  { value: 'prothese', label: 'Prothèse' },
  { value: 'parodontologie', label: 'Parodontologie' },
  { value: 'radiologie', label: 'Radiologie' },
  { value: 'ergonomie', label: 'Ergonomie' },
  { value: 'relation-patient', label: 'Relation Patient' },
  { value: 'sante-pro', label: 'Santé du Praticien' },
  { value: 'numerique', label: 'Numérique & IA' },
  { value: 'environnement', label: 'Environnement' },
];

export default function NewEppAuditPage() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    theme_slug: 'esthetique',
    description: '',
    nb_dossiers_min: 10,
    nb_dossiers_max: 20,
    delai_t2_mois_min: 2,
    delai_t2_mois_max: 6,
    is_published: false,
  });
  const router = useRouter();
  const supabase = createClient();

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setFormData({ ...formData, title, slug: generateSlug(title) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('epp_audits')
        .insert(formData)
        .select()
        .single();

      if (error) throw error;

      router.push(`/admin/epp/${data.id}`);
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <Link href="/admin/epp" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Retour aux audits EPP
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Nouvel audit EPP</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Titre *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={handleTitleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
              placeholder="Ex: Audit Traitement Endodontique"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Slug</label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
              placeholder="auto-genere-depuis-le-titre"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Thématique</label>
            <select
              value={formData.theme_slug}
              onChange={(e) => setFormData({ ...formData, theme_slug: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
            >
              {themeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
              placeholder="Description de l'audit EPP..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dossiers min</label>
              <input
                type="number"
                min="1"
                value={formData.nb_dossiers_min}
                onChange={(e) => setFormData({ ...formData, nb_dossiers_min: parseInt(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dossiers max</label>
              <input
                type="number"
                min="1"
                value={formData.nb_dossiers_max}
                onChange={(e) => setFormData({ ...formData, nb_dossiers_max: parseInt(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Délai T2 min (mois)</label>
              <input
                type="number"
                min="1"
                value={formData.delai_t2_mois_min}
                onChange={(e) => setFormData({ ...formData, delai_t2_mois_min: parseInt(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Délai T2 max (mois)</label>
              <input
                type="number"
                min="1"
                value={formData.delai_t2_mois_max}
                onChange={(e) => setFormData({ ...formData, delai_t2_mois_max: parseInt(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_published"
              checked={formData.is_published}
              onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
              className="w-4 h-4 text-[#2D1B96] border-gray-300 rounded focus:ring-[#2D1B96]"
            />
            <label htmlFor="is_published" className="text-sm font-medium text-gray-700">Publier immédiatement</label>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <Link href="/admin/epp" className="px-6 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50">
              Annuler
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-[#2D1B96] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#231575] disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Création...' : 'Créer'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
