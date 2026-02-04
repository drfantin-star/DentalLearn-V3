'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Save, Plus, X } from 'lucide-react';

interface Formation {
  id: string;
  title: string;
}

export default function NewSequencePage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  
  const formationId = params.id as string;
  
  const [formation, setFormation] = useState<Formation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sequenceCount, setSequenceCount] = useState(0);
  
  const [formData, setFormData] = useState({
    title: '',
    sequence_number: 1,
    estimated_duration_minutes: 3,
    learning_objectives: ['']
  });

  useEffect(() => {
    loadData();
  }, [formationId]);

  async function loadData() {
    // Charger la formation
    const { data: formationData, error: formationError } = await supabase
      .from('formations')
      .select('id, title')
      .eq('id', formationId)
      .single();

    if (formationError || !formationData) {
      router.push('/admin/formations');
      return;
    }

    setFormation(formationData);

    // Compter les séquences existantes
    const { count } = await supabase
      .from('sequences')
      .select('*', { count: 'exact', head: true })
      .eq('formation_id', formationId);

    const nextNumber = (count || 0) + 1;
    setSequenceCount(count || 0);
    setFormData(prev => ({ ...prev, sequence_number: nextNumber }));

    setLoading(false);
  }

  function addObjective() {
    setFormData(prev => ({
      ...prev,
      learning_objectives: [...prev.learning_objectives, '']
    }));
  }

  function removeObjective(index: number) {
    setFormData(prev => ({
      ...prev,
      learning_objectives: prev.learning_objectives.filter((_, i) => i !== index)
    }));
  }

  function updateObjective(index: number, value: string) {
    setFormData(prev => ({
      ...prev,
      learning_objectives: prev.learning_objectives.map((obj, i) => 
        i === index ? value : obj
      )
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      alert('Le titre est requis');
      return;
    }

    setSaving(true);

    const objectives = formData.learning_objectives.filter(obj => obj.trim());

    const { data, error } = await supabase
      .from('sequences')
      .insert({
        formation_id: formationId,
        title: formData.title.trim(),
        sequence_number: formData.sequence_number,
        estimated_duration_minutes: formData.estimated_duration_minutes,
        learning_objectives: objectives
      })
      .select()
      .single();

    if (error) {
      console.error('Erreur création:', error);
      alert('Erreur: ' + error.message);
      setSaving(false);
      return;
    }

    // Rediriger vers la page de la séquence pour ajouter les questions
    router.push(`/admin/formations/${formationId}/sequences/${data.id}`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D1B96]"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link 
          href={`/admin/formations/${formationId}`}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouvelle séquence</h1>
          <p className="text-gray-500">{formation?.title}</p>
        </div>
      </div>

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          {/* Titre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Titre de la séquence *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Approche Diagnostique Fondamentale"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
              required
            />
          </div>

          {/* Numéro et Durée */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Numéro de séquence
              </label>
              <input
                type="number"
                value={formData.sequence_number}
                onChange={(e) => setFormData({ ...formData, sequence_number: parseInt(e.target.value) })}
                min="1"
                max="15"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Position dans le parcours (1-15)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Durée estimée (minutes)
              </label>
              <input
                type="number"
                value={formData.estimated_duration_minutes}
                onChange={(e) => setFormData({ ...formData, estimated_duration_minutes: parseInt(e.target.value) })}
                min="1"
                max="10"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Recommandé: 3-4 minutes pour 4 questions</p>
            </div>
          </div>

          {/* Objectifs pédagogiques */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Objectifs pédagogiques
            </label>
            <div className="space-y-3">
              {formData.learning_objectives.map((objective, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={objective}
                    onChange={(e) => updateObjective(index, e.target.value)}
                    placeholder={`Objectif ${index + 1}`}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                  />
                  {formData.learning_objectives.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeObjective(index)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addObjective}
              className="mt-3 flex items-center gap-2 text-sm text-[#2D1B96] hover:text-[#231575] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Ajouter un objectif
            </button>
          </div>
        </div>

        {/* Boutons */}
        <div className="flex gap-4">
          <Link
            href={`/admin/formations/${formationId}`}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-center"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-6 py-3 bg-[#2D1B96] text-white rounded-lg hover:bg-[#231575] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Création...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Créer la séquence
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
