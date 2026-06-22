'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  ChevronRight,
  Headphones,
  LineChart,
  Clapperboard,
  FileText
} from 'lucide-react';

interface Formation {
  id: string;
  title: string;
  instructor_name: string;
  category: string;
  level: string;
  total_sequences: number;
  is_published: boolean;
  axe_cp: number | null;
  created_at: string;
}

// Agrégat de l'avancement « pipeline » d'une formation, calculé à partir de
// ses séquences. `total` = nombre de séquences de la formation.
interface PipelineCounts {
  total: number;
  audio: number;
  timeline: number;
  scenes: number;
  fiches: number;
}

type AxeFilter = 'all' | '1' | '2' | '3' | '4' | 'none';
type SortOrder = 'recent' | 'old';

const EMPTY_PIPELINE: PipelineCounts = {
  total: 0,
  audio: 0,
  timeline: 0,
  scenes: 0,
  fiches: 0
};

export default function FormationsPage() {
  const supabase = createClient();

  const [formations, setFormations] = useState<Formation[]>([]);
  const [pipelines, setPipelines] = useState<Record<string, PipelineCounts>>({});
  const [loading, setLoading] = useState(true);

  // Filtres et tri — state React uniquement (jamais de persistance).
  const [axeFilter, setAxeFilter] = useState<AxeFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent');

  useEffect(() => {
    loadFormations();
    loadPipelines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Charge les colonnes « pipeline » de toutes les séquences puis agrège par
  // formation. Une seule requête, agrégation côté client.
  const loadPipelines = async () => {
    try {
      const { data, error } = await supabase
        .from('sequences')
        .select(
          'formation_id, course_media_url, timeline_url, timeline_published, infographic_url'
        );

      if (error) {
        console.error('Erreur chargement pipeline séquences:', error);
        return;
      }

      const map: Record<string, PipelineCounts> = {};
      for (const seq of data || []) {
        const fid = seq.formation_id as string;
        if (!map[fid]) {
          map[fid] = { total: 0, audio: 0, timeline: 0, scenes: 0, fiches: 0 };
        }
        const counts = map[fid];
        counts.total += 1;
        if (seq.course_media_url) counts.audio += 1;
        if (seq.timeline_url) counts.timeline += 1;
        if (seq.timeline_published) counts.scenes += 1;
        if (seq.infographic_url) counts.fiches += 1;
      }

      setPipelines(map);
    } catch (error) {
      console.error('Erreur chargement pipeline séquences:', error);
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

  // Liste affichée = filtre par axe puis tri par date d'ajout. Les deux se
  // combinent. `useMemo` pour ne recalculer qu'au changement de dépendance.
  const visibleFormations = useMemo(() => {
    const filtered = formations.filter((f) => {
      if (axeFilter === 'all') return true;
      if (axeFilter === 'none') return f.axe_cp == null;
      return f.axe_cp === Number(axeFilter);
    });

    return [...filtered].sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return sortOrder === 'recent' ? bTime - aTime : aTime - bTime;
    });
  }, [formations, axeFilter, sortOrder]);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Formations</h1>
          <p className="text-gray-600 mt-1">Gérez vos formations</p>
        </div>
        <Link
          href="/admin/formations/new"
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nouvelle formation
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : formations.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <p className="text-gray-500 mb-4">Aucune formation</p>
          <Link
            href="/admin/formations/new"
            className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl"
          >
            <Plus className="w-5 h-5" />
            Créer votre première formation
          </Link>
        </div>
      ) : (
        <>
          {/* Filtre par axe + tri par date d'ajout (combinables). */}
          <div className="flex flex-wrap items-end gap-4 mb-4">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="axe-filter"
                className="text-xs font-medium text-gray-500"
              >
                Filtrer par axe
              </label>
              <select
                id="axe-filter"
                value={axeFilter}
                onChange={(e) => setAxeFilter(e.target.value as AxeFilter)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">Tous</option>
                <option value="1">Axe 1</option>
                <option value="2">Axe 2</option>
                <option value="3">Axe 3</option>
                <option value="4">Axe 4</option>
                <option value="none">Non classé</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="sort-order"
                className="text-xs font-medium text-gray-500"
              >
                Trier par date d&apos;ajout
              </label>
              <select
                id="sort-order"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="recent">Plus récent</option>
                <option value="old">Plus ancien</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Formation</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Formateur</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Séquences</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Statut</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Pipeline</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {visibleFormations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      Aucune formation pour ce filtre
                    </td>
                  </tr>
                ) : (
                  visibleFormations.map((formation) => (
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
                        <PipelineCell counts={pipelines[formation.id] ?? EMPTY_PIPELINE} />
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
                            className="p-2 text-primary hover:bg-primary/10 rounded-lg"
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// Couleur d'une pastille selon l'avancement : vert si toutes les séquences
// sont couvertes, orange si partiellement, gris si aucune (ou aucune séquence).
function pipelineColor(count: number, total: number): string {
  if (total > 0 && count === total) return 'text-green-600';
  if (count > 0) return 'text-orange-500';
  return 'text-gray-300';
}

// 4 mini-pastilles côte à côte : Audio · Timeline · Scènes · Fiches.
function PipelineCell({ counts }: { counts: PipelineCounts }) {
  const items: { label: string; count: number; Icon: typeof Headphones }[] = [
    { label: 'Audio', count: counts.audio, Icon: Headphones },
    { label: 'Timeline', count: counts.timeline, Icon: LineChart },
    { label: 'Scènes', count: counts.scenes, Icon: Clapperboard },
    { label: 'Fiches', count: counts.fiches, Icon: FileText }
  ];

  return (
    <div className="flex items-center gap-2">
      {items.map(({ label, count, Icon }) => (
        <span
          key={label}
          title={`${label} : ${count}/${counts.total}`}
          className={pipelineColor(count, counts.total)}
        >
          <Icon className="w-5 h-5" />
        </span>
      ))}
    </div>
  );
}
