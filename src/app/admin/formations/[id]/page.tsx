'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  FileText,
  Clock,
  HelpCircle,
  GripVertical,
  Eye
} from 'lucide-react';

interface Formation {
  id: string;
  title: string;
  slug: string;
  description_short: string;
  description_long: string;
  instructor_name: string;
  category: string;
  level: string;
  total_sequences: number;
  duration_weeks: number;
  is_published: boolean;
  created_at: string;
}

interface Sequence {
  id: string;
  formation_id: string;
  sequence_number: number;
  title: string;
  estimated_duration_minutes: number;
  learning_objectives: string[];
  created_at: string;
  questions_count?: number;
}

export default function FormationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  
  const [formation, setFormation] = useState<Formation | null>(null);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const formationId = params.id as string;

  useEffect(() => {
    loadFormationAndSequences();
  }, [formationId]);

  async function loadFormationAndSequences() {
    setLoading(true);

    try {
      // Charger la formation via API admin
      const formationResponse = await fetch(`/api/admin/formations/${formationId}`);
      const formationResult = await formationResponse.json();

      if (!formationResponse.ok) {
        console.error('Erreur chargement formation:', formationResult.error);
        router.push('/admin/formations');
        return;
      }

      setFormation(formationResult.formation);

      // Charger les séquences avec le nombre de questions
      const { data: sequencesData, error: sequencesError } = await supabase
        .from('sequences')
        .select(`
          *,
          questions:questions(count)
        `)
        .eq('formation_id', formationId)
        .order('sequence_number', { ascending: true });

      if (sequencesError) {
        console.error('Erreur chargement séquences:', sequencesError);
      } else {
        const sequencesWithCount = sequencesData?.map(seq => ({
          ...seq,
          questions_count: seq.questions?.[0]?.count || 0
        })) || [];
        setSequences(sequencesWithCount);
      }
    } catch (error) {
      console.error('Erreur chargement:', error);
      router.push('/admin/formations');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSequence(sequenceId: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette séquence ? Toutes les questions associées seront également supprimées.')) {
      return;
    }

    setDeleting(sequenceId);

    // Supprimer d'abord les questions
    await supabase
      .from('questions')
      .delete()
      .eq('sequence_id', sequenceId);

    // Puis supprimer la séquence
    const { error } = await supabase
      .from('sequences')
      .delete()
      .eq('id', sequenceId);

    if (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    } else {
      setSequences(sequences.filter(s => s.id !== sequenceId));
    }

    setDeleting(null);
  }

  async function togglePublish() {
    if (!formation) return;

    const isPublishing = !formation.is_published;

    try {
      const response = await fetch(`/api/admin/formations/${formation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: isPublishing })
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Erreur publication:', result.error);
        alert('Erreur lors de la mise à jour: ' + result.error);
        return;
      }

      setFormation({ ...formation, is_published: isPublishing });
    } catch (error) {
      console.error('Erreur publication:', error);
      alert('Erreur lors de la mise à jour');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D1B96]"></div>
      </div>
    );
  }

  if (!formation) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Formation non trouvée</p>
        <Link href="/admin/formations" className="text-[#2D1B96] hover:underline mt-4 inline-block">
          Retour aux formations
        </Link>
      </div>
    );
  }

  const totalQuestions = sequences.reduce((acc, seq) => acc + (seq.questions_count || 0), 0);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          href="/admin/formations"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{formation.title}</h1>
          <p className="text-gray-500">par {formation.instructor_name}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={togglePublish}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              formation.is_published
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
            }`}
          >
            {formation.is_published ? '✓ Publiée' : 'Brouillon'}
          </button>
          <Link
            href={`/admin/formations/${formation.id}/edit`}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Modifier
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{sequences.length}</p>
              <p className="text-sm text-gray-500">Séquences</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <HelpCircle className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalQuestions}</p>
              <p className="text-sm text-gray-500">Questions</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formation.duration_weeks}</p>
              <p className="text-sm text-gray-500">Semaines</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Eye className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 capitalize">{formation.level}</p>
              <p className="text-sm text-gray-500">Niveau</p>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {formation.description_short && (
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="font-semibold text-gray-900 mb-2">Description</h2>
          <p className="text-gray-600">{formation.description_short}</p>
        </div>
      )}

      {/* Séquences */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Séquences</h2>
            <p className="text-sm text-gray-500">
              {sequences.length} séquence{sequences.length > 1 ? 's' : ''} • Objectif: 15 séquences
            </p>
          </div>
          <Link
            href={`/admin/formations/${formation.id}/sequences/new`}
            className="px-4 py-2 bg-[#2D1B96] text-white rounded-lg hover:bg-[#231575] transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Ajouter une séquence
          </Link>
        </div>

        {sequences.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune séquence</h3>
            <p className="text-gray-500 mb-4">Commencez par créer votre première séquence</p>
            <Link
              href={`/admin/formations/${formation.id}/sequences/new`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#2D1B96] text-white rounded-lg hover:bg-[#231575] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Créer une séquence
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {sequences.map((sequence) => (
              <div
                key={sequence.id}
                className="p-4 hover:bg-gray-50 transition-colors flex items-center gap-4"
              >
                <div className="p-2 text-gray-400 cursor-grab">
                  <GripVertical className="w-5 h-5" />
                </div>
                
                <div className="w-10 h-10 bg-[#2D1B96] text-white rounded-lg flex items-center justify-center font-bold">
                  {sequence.sequence_number}
                </div>
                
                <div className="flex-1 min-w-0">
                  <Link 
                    href={`/admin/formations/${formation.id}/sequences/${sequence.id}`}
                    className="font-medium text-gray-900 hover:text-[#2D1B96] transition-colors"
                  >
                    {sequence.title}
                  </Link>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span>{sequence.estimated_duration_minutes} min</span>
                    <span>•</span>
                    <span className={sequence.questions_count === 4 ? 'text-green-600' : 'text-orange-600'}>
                      {sequence.questions_count}/4 questions
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/formations/${formation.id}/sequences/${sequence.id}`}
                    className="p-2 text-gray-400 hover:text-[#2D1B96] hover:bg-gray-100 rounded-lg transition-colors"
                    title="Voir les questions"
                  >
                    <Eye className="w-5 h-5" />
                  </Link>
                  <Link
                    href={`/admin/formations/${formation.id}/sequences/${sequence.id}/edit`}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Modifier"
                  >
                    <Edit className="w-5 h-5" />
                  </Link>
                  <button
                    onClick={() => handleDeleteSequence(sequence.id)}
                    disabled={deleting === sequence.id}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Supprimer"
                  >
                    {deleting === sequence.id ? (
                      <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progression */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="font-semibold text-gray-900 mb-4">Progression du contenu</h2>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Séquences</span>
              <span className="font-medium">{sequences.length}/15</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-[#2D1B96] h-2 rounded-full transition-all"
                style={{ width: `${(sequences.length / 15) * 100}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Questions</span>
              <span className="font-medium">{totalQuestions}/60</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-[#00D1C1] h-2 rounded-full transition-all"
                style={{ width: `${(totalQuestions / 60) * 100}%` }}
              />
            </div>
          </div>
        </div>
        
        {sequences.length === 15 && totalQuestions === 60 && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700 text-sm font-medium">
              ✓ Formation complète ! Prête à être publiée.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
