'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  Beaker,
  Unlock,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  BookOpen,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface Formation {
  id: string;
  title: string;
  total_sequences: number;
}

interface UserFormation {
  id: string;
  user_id: string;
  formation_id: string;
  current_sequence: number;
  formation?: Formation;
}

export default function TestModePage() {
  const [loading, setLoading] = useState(true);
  const [userFormations, setUserFormations] = useState<UserFormation[]>([]);
  const [expandedFormation, setExpandedFormation] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  const checkAdminAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      if (session.user.email !== 'drfantin@gmail.com') {
        router.push('/');
        return;
      }

      await loadUserFormations(session.user.id);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserFormations = async (userId: string) => {
    // Charger les inscriptions de l'admin
    const { data: ufData, error: ufError } = await supabase
      .from('user_formations')
      .select('*')
      .eq('user_id', userId);

    if (ufError) {
      console.error('Erreur:', ufError);
      return;
    }

    if (!ufData || ufData.length === 0) {
      setUserFormations([]);
      return;
    }

    // Charger les formations
    const formationIds = ufData.map(uf => uf.formation_id);
    const { data: formationsData } = await supabase
      .from('formations')
      .select('id, title, total_sequences')
      .in('id', formationIds);

    // Enrichir les données
    const enriched = ufData.map(uf => ({
      ...uf,
      formation: formationsData?.find(f => f.id === uf.formation_id)
    }));

    setUserFormations(enriched);
  };

  const unlockAllSequences = async (userFormationId: string, totalSequences: number) => {
    setProcessing(userFormationId);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('user_formations')
        .update({ current_sequence: totalSequences })
        .eq('id', userFormationId);

      if (error) throw error;

      // Mettre à jour l'état local
      setUserFormations(prev => prev.map(uf =>
        uf.id === userFormationId
          ? { ...uf, current_sequence: totalSequences }
          : uf
      ));

      setMessage({
        type: 'success',
        text: `Toutes les séquences débloquées !`
      });
    } catch (error) {
      console.error('Erreur:', error);
      setMessage({
        type: 'error',
        text: 'Erreur lors du déblocage'
      });
    } finally {
      setProcessing(null);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const setSpecificSequence = async (userFormationId: string, sequenceNumber: number) => {
    setProcessing(userFormationId);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('user_formations')
        .update({ current_sequence: sequenceNumber })
        .eq('id', userFormationId);

      if (error) throw error;

      setUserFormations(prev => prev.map(uf =>
        uf.id === userFormationId
          ? { ...uf, current_sequence: sequenceNumber }
          : uf
      ));

      setMessage({
        type: 'success',
        text: `Séquence ${sequenceNumber} définie comme dernière débloquée`
      });
    } catch (error) {
      console.error('Erreur:', error);
      setMessage({
        type: 'error',
        text: 'Erreur lors de la modification'
      });
    } finally {
      setProcessing(null);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const resetProgress = async (userFormationId: string) => {
    if (!confirm('Remettre la progression à la séquence 1 ?')) return;

    setProcessing(userFormationId);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('user_formations')
        .update({ current_sequence: 1 })
        .eq('id', userFormationId);

      if (error) throw error;

      setUserFormations(prev => prev.map(uf =>
        uf.id === userFormationId
          ? { ...uf, current_sequence: 1 }
          : uf
      ));

      setMessage({
        type: 'success',
        text: 'Progression réinitialisée'
      });
    } catch (error) {
      console.error('Erreur:', error);
      setMessage({
        type: 'error',
        text: 'Erreur lors de la réinitialisation'
      });
    } finally {
      setProcessing(null);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D1B96]"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-yellow-100 rounded-xl">
            <Beaker className="w-8 h-8 text-yellow-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mode Test</h1>
            <p className="text-gray-600">Débloquer les séquences pour tester l'application</p>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          {message.text}
        </div>
      )}

      {/* Info */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium mb-1">Mode Test - Uniquement pour l'admin</p>
            <p>
              Cette page permet de débloquer toutes les séquences d'une formation
              pour tester le contenu sans avoir à compléter chaque séquence.
            </p>
          </div>
        </div>
      </div>

      {/* Liste des formations */}
      {userFormations.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune formation inscrite</h3>
          <p className="text-gray-500">
            Inscrivez-vous à une formation depuis la page d'accueil pour pouvoir la tester.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {userFormations.map((uf) => (
            <div key={uf.id} className="bg-white rounded-xl shadow-md overflow-hidden">
              {/* Header formation */}
              <div
                className="p-6 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedFormation(
                  expandedFormation === uf.id ? null : uf.id
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#2D1B96]/10 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-[#2D1B96]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {uf.formation?.title || 'Formation inconnue'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Progression : Séquence {uf.current_sequence} / {uf.formation?.total_sequences || 15}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    uf.current_sequence >= (uf.formation?.total_sequences || 15)
                      ? 'bg-green-100 text-green-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {uf.current_sequence >= (uf.formation?.total_sequences || 15)
                      ? 'Tout débloqué'
                      : `${uf.current_sequence} débloquée${uf.current_sequence > 1 ? 's' : ''}`}
                  </span>
                  {expandedFormation === uf.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Actions (expanded) */}
              {expandedFormation === uf.id && (
                <div className="px-6 pb-6 pt-2 border-t border-gray-100">
                  <div className="flex flex-wrap gap-3 mb-4">
                    {/* Débloquer tout */}
                    <button
                      onClick={() => unlockAllSequences(uf.id, uf.formation?.total_sequences || 15)}
                      disabled={processing === uf.id}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {processing === uf.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Unlock className="w-4 h-4" />
                      )}
                      Débloquer toutes les séquences
                    </button>

                    {/* Reset */}
                    <button
                      onClick={() => resetProgress(uf.id)}
                      disabled={processing === uf.id}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Réinitialiser à 1
                    </button>
                  </div>

                  {/* Sélection séquence spécifique */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Ou définir une séquence spécifique :
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: uf.formation?.total_sequences || 15 }, (_, i) => i + 1).map((num) => (
                        <button
                          key={num}
                          onClick={() => setSpecificSequence(uf.id, num)}
                          disabled={processing === uf.id}
                          className={`w-10 h-10 rounded-lg font-medium text-sm transition-colors ${
                            num <= uf.current_sequence
                              ? 'bg-[#2D1B96] text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          } ${processing === uf.id ? 'opacity-50' : ''}`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Cliquez sur un numéro pour définir cette séquence comme la dernière débloquée
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
