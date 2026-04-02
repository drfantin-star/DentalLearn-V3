'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Plus, Edit, Trash2, Eye, EyeOff, ChevronRight } from 'lucide-react';

interface EppAudit {
  id: string;
  title: string;
  theme_slug: string;
  is_published: boolean;
  nb_criteres: number;
  created_at: string;
}

const themeLabels: Record<string, string> = {
  esthetique: 'Esthétique Dentaire',
  restauratrice: 'Dentisterie Restauratrice',
  endodontie: 'Endodontie',
  chirurgie: 'Chirurgie Orale',
  implant: 'Implantologie',
  prothese: 'Prothèse',
  parodontologie: 'Parodontologie',
  radiologie: 'Radiologie',
  ergonomie: 'Ergonomie',
  'relation-patient': 'Relation Patient',
  'sante-pro': 'Santé du Praticien',
  numerique: 'Numérique & IA',
  environnement: 'Environnement',
};

export default function EppListPage() {
  const [audits, setAudits] = useState<EppAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadAudits();
  }, []);

  const loadAudits = async () => {
    try {
      const { data, error } = await supabase
        .from('epp_audits')
        .select('*, epp_criteria(id)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        theme_slug: a.theme_slug,
        is_published: a.is_published,
        nb_criteres: Array.isArray(a.epp_criteria) ? a.epp_criteria.length : 0,
        created_at: a.created_at,
      }));

      setAudits(mapped);
    } catch (error) {
      console.error('Erreur chargement audits EPP:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePublish = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('epp_audits')
        .update({ is_published: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      loadAudits();
    } catch (error) {
      console.error('Erreur mise à jour:', error);
      alert('Erreur lors de la mise à jour du statut');
    }
  };

  const deleteAudit = async (id: string, title: string) => {
    if (!confirm(`Supprimer "${title}" et tous ses critères ?`)) return;

    try {
      const { error } = await supabase
        .from('epp_audits')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadAudits();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audits EPP</h1>
          <p className="text-gray-600 mt-1">Gérez vos audits d'évaluation des pratiques professionnelles</p>
        </div>
        <Link
          href="/admin/epp/new"
          className="flex items-center gap-2 bg-[#2D1B96] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#231575] transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nouvel audit EPP
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D1B96]"></div>
        </div>
      ) : audits.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <p className="text-gray-500 mb-4">Aucun audit EPP</p>
          <Link
            href="/admin/epp/new"
            className="inline-flex items-center gap-2 bg-[#2D1B96] text-white px-6 py-3 rounded-xl"
          >
            <Plus className="w-5 h-5" />
            Créer votre premier audit EPP
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Titre</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Thématique</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Critères</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Statut</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {audits.map((audit) => (
                <tr key={audit.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{audit.title}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {themeLabels[audit.theme_slug] || audit.theme_slug}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{audit.nb_criteres}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      audit.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {audit.is_published ? 'Publié' : 'Brouillon'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => togglePublish(audit.id, audit.is_published)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                        title={audit.is_published ? 'Dépublier' : 'Publier'}
                      >
                        {audit.is_published ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                      <Link
                        href={`/admin/epp/${audit.id}`}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                        title="Voir / Modifier"
                      >
                        <Edit className="w-5 h-5" />
                      </Link>
                      <button
                        onClick={() => deleteAudit(audit.id, audit.title)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        title="Supprimer"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
