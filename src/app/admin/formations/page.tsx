'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Edit, Trash2, Eye, EyeOff, ChevronRight } from 'lucide-react';

interface Formation {
  id: string;
  title: string;
  instructor_name: string;
  category: string;
  level: string;
  total_sequences: number;
  is_published: boolean;
}

export default function FormationsPage() {
  const [formations, setFormations] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFormations();
  }, []);

  const loadFormations = async () => {
    try {
      const response = await fetch('/api/admin/formations');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur chargement formations');
      }

      setFormations(result.formations || []);
    } catch (error) {
      console.error('Erreur chargement formations:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePublish = async (id: string, currentStatus: boolean) => {
    const isPublishing = !currentStatus;

    try {
      const response = await fetch(`/api/admin/formations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: isPublishing })
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Erreur mise à jour:', result.error);
        alert('Erreur lors de la mise à jour du statut: ' + result.error);
        return;
      }

      loadFormations();
    } catch (error) {
      console.error('Erreur mise à jour:', error);
      alert('Erreur lors de la mise à jour du statut');
    }
  };

  const deleteFormation = async (id: string, title: string) => {
    if (!confirm(`Supprimer "${title}" et tout son contenu ?`)) return;

    try {
      const response = await fetch(`/api/admin/formations/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const result = await response.json();
        alert('Erreur lors de la suppression: ' + result.error);
        return;
      }

      loadFormations();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      esthetique: 'Esthétique',
      restauratrice: 'Restauratrice',
      chirurgie: 'Chirurgie',
      implant: 'Implantologie',
      prothese: 'Prothèse',
      parodontologie: 'Parodontologie',
      endodontie: 'Endodontie',
      'soft-skills': 'Soft Skills'
    };
    return labels[category] || category;
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Formations</h1>
          <p className="text-gray-600 mt-1">Gérez vos formations</p>
        </div>
        <Link
          href="/admin/formations/new"
          className="flex items-center gap-2 bg-[#2D1B96] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#231575] transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nouvelle formation
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D1B96]"></div>
        </div>
      ) : formations.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <p className="text-gray-500 mb-4">Aucune formation</p>
          <Link
            href="/admin/formations/new"
            className="inline-flex items-center gap-2 bg-[#2D1B96] text-white px-6 py-3 rounded-xl"
          >
            <Plus className="w-5 h-5" />
            Créer votre première formation
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Formation</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Formateur</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Séquences</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Statut</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {formations.map((formation) => (
                <tr key={formation.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{formation.title}</p>
                    <p className="text-sm text-gray-500">{getCategoryLabel(formation.category)}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{formation.instructor_name}</td>
                  <td className="px-6 py-4 text-gray-600">{formation.total_sequences}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      formation.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {formation.is_published ? 'Publié' : 'Brouillon'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => togglePublish(formation.id, formation.is_published)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                        title={formation.is_published ? 'Dépublier' : 'Publier'}
                      >
                        {formation.is_published ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                      <Link
                        href={`/admin/formations/${formation.id}/edit`}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                        title="Modifier"
                      >
                        <Edit className="w-5 h-5" />
                      </Link>
                      <Link
                        href={`/admin/formations/${formation.id}`}
                        className="p-2 text-[#2D1B96] hover:bg-[#2D1B96]/10 rounded-lg"
                        title="Voir détails"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </Link>
                      <button
                        onClick={() => deleteFormation(formation.id, formation.title)}
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
