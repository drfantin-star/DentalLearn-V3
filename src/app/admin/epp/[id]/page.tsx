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
  ChevronDown,
  ChevronRight,
  Save,
  X,
} from 'lucide-react';

interface EppAudit {
  id: string;
  title: string;
  slug: string;
  theme_slug: string;
  description: string;
  nb_dossiers_min: number;
  nb_dossiers_max: number;
  delai_t2_mois_min: number;
  delai_t2_mois_max: number;
  is_published: boolean;
  created_at: string;
}

interface Criterion {
  id: string;
  audit_id: string;
  code: string;
  type: string;
  label: string;
  source: string;
  sort_order: number;
}

interface Suggestion {
  id: string;
  criterion_id: string;
  text: string;
  sequence_ref: string | null;
  sort_order: number;
}

const themeLabels: Record<string, string> = {
  esthetique: 'Esthetique Dentaire',
  restauratrice: 'Dentisterie Restauratrice',
  endodontie: 'Endodontie',
  chirurgie: 'Chirurgie Orale',
  implant: 'Implantologie',
  prothese: 'Prothese',
  parodontologie: 'Parodontologie',
  radiologie: 'Radiologie',
  ergonomie: 'Ergonomie',
  'relation-patient': 'Relation Patient',
  'sante-pro': 'Sante du Praticien',
  numerique: 'Numerique & IA',
  environnement: 'Environnement',
};

const typeBadgeClasses: Record<string, string> = {
  R: 'bg-purple-100 text-purple-700',
  P: 'bg-blue-100 text-blue-700',
  S: 'bg-green-100 text-green-700',
};

export default function EppAuditDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const auditId = params.id as string;

  const [audit, setAudit] = useState<EppAudit | null>(null);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Criterion form
  const [showCriterionForm, setShowCriterionForm] = useState(false);
  const [editingCriterion, setEditingCriterion] = useState<Criterion | null>(null);
  const [criterionForm, setCriterionForm] = useState({
    code: '',
    type: 'R',
    label: '',
    source: '',
    sort_order: 0,
  });
  const [savingCriterion, setSavingCriterion] = useState(false);

  // Suggestion form
  const [showSuggestionFor, setShowSuggestionFor] = useState<string | null>(null);
  const [suggestionForm, setSuggestionForm] = useState({
    text: '',
    sequence_ref: '',
    sort_order: 0,
  });
  const [savingSuggestion, setSavingSuggestion] = useState(false);

  // Expanded criteria (to show suggestions)
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAll();
  }, [auditId]);

  async function loadAll() {
    setLoading(true);
    try {
      const { data: auditData, error: auditError } = await supabase
        .from('epp_audits')
        .select('*')
        .eq('id', auditId)
        .single();

      if (auditError) throw auditError;
      setAudit(auditData);

      const { data: criteriaData, error: criteriaError } = await supabase
        .from('epp_criteria')
        .select('*')
        .eq('audit_id', auditId)
        .order('sort_order');

      if (criteriaError) throw criteriaError;
      setCriteria(criteriaData || []);

      if (criteriaData && criteriaData.length > 0) {
        const { data: suggestionsData, error: suggestionsError } = await supabase
          .from('epp_improvement_suggestions')
          .select('*')
          .in('criterion_id', criteriaData.map((c: Criterion) => c.id))
          .order('sort_order');

        if (suggestionsError) throw suggestionsError;
        setSuggestions(suggestionsData || []);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Erreur chargement audit:', error);
      router.push('/admin/epp');
    } finally {
      setLoading(false);
    }
  }

  async function togglePublish() {
    if (!audit) return;
    try {
      const { error } = await supabase
        .from('epp_audits')
        .update({ is_published: !audit.is_published })
        .eq('id', auditId);

      if (error) throw error;
      setAudit({ ...audit, is_published: !audit.is_published });
    } catch (error) {
      console.error('Erreur publication:', error);
      alert('Erreur lors de la mise a jour');
    }
  }

  // --- Criteria CRUD ---

  function openCriterionForm(criterion?: Criterion) {
    if (criterion) {
      setEditingCriterion(criterion);
      setCriterionForm({
        code: criterion.code,
        type: criterion.type,
        label: criterion.label,
        source: criterion.source || '',
        sort_order: criterion.sort_order,
      });
    } else {
      setEditingCriterion(null);
      const nextOrder = criteria.length > 0 ? Math.max(...criteria.map(c => c.sort_order)) + 1 : 1;
      const nextCode = `C${criteria.length + 1}`;
      setCriterionForm({
        code: nextCode,
        type: 'R',
        label: '',
        source: '',
        sort_order: nextOrder,
      });
    }
    setShowCriterionForm(true);
  }

  function closeCriterionForm() {
    setShowCriterionForm(false);
    setEditingCriterion(null);
  }

  async function saveCriterion(e: React.FormEvent) {
    e.preventDefault();
    setSavingCriterion(true);

    try {
      if (editingCriterion) {
        const { error } = await supabase
          .from('epp_criteria')
          .update({
            code: criterionForm.code,
            type: criterionForm.type,
            label: criterionForm.label,
            source: criterionForm.source,
            sort_order: criterionForm.sort_order,
          })
          .eq('id', editingCriterion.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('epp_criteria')
          .insert({
            audit_id: auditId,
            code: criterionForm.code,
            type: criterionForm.type,
            label: criterionForm.label,
            source: criterionForm.source,
            sort_order: criterionForm.sort_order,
          });

        if (error) throw error;
      }

      closeCriterionForm();
      await loadAll();
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    } finally {
      setSavingCriterion(false);
    }
  }

  async function deleteCriterion(id: string, code: string) {
    if (!confirm(`Supprimer le critere "${code}" et toutes ses suggestions ?`)) return;

    try {
      const { error } = await supabase
        .from('epp_criteria')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadAll();
    } catch (error) {
      console.error('Erreur suppression critere:', error);
      alert('Erreur lors de la suppression');
    }
  }

  // --- Suggestions CRUD ---

  function openSuggestionForm(criterionId: string) {
    const criterionSuggestions = suggestions.filter(s => s.criterion_id === criterionId);
    const nextOrder = criterionSuggestions.length > 0
      ? Math.max(...criterionSuggestions.map(s => s.sort_order)) + 1
      : 1;
    setSuggestionForm({ text: '', sequence_ref: '', sort_order: nextOrder });
    setShowSuggestionFor(criterionId);
  }

  async function saveSuggestion(e: React.FormEvent, criterionId: string) {
    e.preventDefault();
    setSavingSuggestion(true);

    try {
      const { error } = await supabase
        .from('epp_improvement_suggestions')
        .insert({
          criterion_id: criterionId,
          text: suggestionForm.text,
          sequence_ref: suggestionForm.sequence_ref || null,
          sort_order: suggestionForm.sort_order,
        });

      if (error) throw error;
      setShowSuggestionFor(null);
      await loadAll();
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    } finally {
      setSavingSuggestion(false);
    }
  }

  async function deleteSuggestion(id: string) {
    if (!confirm('Supprimer cette suggestion ?')) return;

    try {
      const { error } = await supabase
        .from('epp_improvement_suggestions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadAll();
    } catch (error) {
      console.error('Erreur suppression suggestion:', error);
      alert('Erreur lors de la suppression');
    }
  }

  function toggleExpand(criterionId: string) {
    setExpandedCriteria(prev => {
      const next = new Set(prev);
      if (next.has(criterionId)) {
        next.delete(criterionId);
      } else {
        next.add(criterionId);
      }
      return next;
    });
  }

  function getSuggestionsForCriterion(criterionId: string) {
    return suggestions.filter(s => s.criterion_id === criterionId);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D1B96]"></div>
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Audit non trouve</p>
        <Link href="/admin/epp" className="text-[#2D1B96] hover:underline mt-4 inline-block">
          Retour aux audits EPP
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/epp"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{audit.title}</h1>
          <p className="text-gray-500">{themeLabels[audit.theme_slug] || audit.theme_slug}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={togglePublish}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              audit.is_published
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
            }`}
          >
            {audit.is_published ? 'Publie' : 'Brouillon'}
          </button>
          <Link
            href={`/admin/epp/${audit.id}/edit`}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Modifier
          </Link>
        </div>
      </div>

      {/* Section 1 — Infos */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="font-semibold text-gray-900 mb-4">Informations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {audit.description && (
            <div className="md:col-span-2">
              <span className="text-gray-500">Description :</span>
              <p className="text-gray-900 mt-1">{audit.description}</p>
            </div>
          )}
          <div>
            <span className="text-gray-500">Dossiers :</span>
            <span className="text-gray-900 ml-2">{audit.nb_dossiers_min} - {audit.nb_dossiers_max}</span>
          </div>
          <div>
            <span className="text-gray-500">Delai T2 :</span>
            <span className="text-gray-900 ml-2">{audit.delai_t2_mois_min} - {audit.delai_t2_mois_max} mois</span>
          </div>
        </div>
      </div>

      {/* Section 2 — Criteres */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Criteres</h2>
            <p className="text-sm text-gray-500">
              {criteria.length} critere{criteria.length > 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => openCriterionForm()}
            className="px-4 py-2 bg-[#2D1B96] text-white rounded-lg hover:bg-[#231575] transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Ajouter un critere
          </button>
        </div>

        {criteria.length === 0 && !showCriterionForm ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 mb-4">Aucun critere</p>
            <button
              onClick={() => openCriterionForm()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#2D1B96] text-white rounded-lg hover:bg-[#231575] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Creer le premier critere
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {criteria.map((criterion) => {
              const isExpanded = expandedCriteria.has(criterion.id);
              const criterionSuggestions = getSuggestionsForCriterion(criterion.id);

              return (
                <div key={criterion.id}>
                  <div className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleExpand(criterion.id)}
                        className="p-1 mt-0.5 text-gray-400 hover:text-gray-600"
                      >
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4" />
                          : <ChevronRight className="w-4 h-4" />
                        }
                      </button>

                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-700">
                        {criterion.code}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${typeBadgeClasses[criterion.type] || 'bg-gray-100 text-gray-700'}`}>
                        {criterion.type}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900">{criterion.label}</p>
                        {criterion.source && (
                          <p className="text-sm text-gray-500 mt-1">{criterion.source}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          Suggestions : {criterionSuggestions.length}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openCriterionForm(criterion)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteCriterion(criterion.id, criterion.code)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded: Suggestions */}
                  {isExpanded && (
                    <div className="bg-gray-50 px-6 py-4 border-t border-gray-100">
                      <div className="ml-8 space-y-2">
                        {criterionSuggestions.length === 0 ? (
                          <p className="text-sm text-gray-400 italic">Aucune suggestion</p>
                        ) : (
                          criterionSuggestions.map((suggestion) => (
                            <div
                              key={suggestion.id}
                              className="flex items-start gap-3 bg-white rounded-lg p-3 border border-gray-200"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900">{suggestion.text}</p>
                                {suggestion.sequence_ref && (
                                  <p className="text-xs text-gray-500 mt-1">{suggestion.sequence_ref}</p>
                                )}
                              </div>
                              <button
                                onClick={() => deleteSuggestion(suggestion.id)}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        )}

                        {/* Add suggestion form */}
                        {showSuggestionFor === criterion.id ? (
                          <form
                            onSubmit={(e) => saveSuggestion(e, criterion.id)}
                            className="bg-white rounded-lg p-4 border border-gray-200 space-y-3"
                          >
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Texte *</label>
                              <textarea
                                required
                                rows={2}
                                value={suggestionForm.text}
                                onChange={(e) => setSuggestionForm({ ...suggestionForm, text: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                                placeholder="Texte de la suggestion..."
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Sequence ref</label>
                                <input
                                  type="text"
                                  value={suggestionForm.sequence_ref}
                                  onChange={(e) => setSuggestionForm({ ...suggestionForm, sequence_ref: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                                  placeholder="Ex: Sequence 2 - La Triade Diagnostique"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Ordre</label>
                                <input
                                  type="number"
                                  value={suggestionForm.sort_order}
                                  onChange={(e) => setSuggestionForm({ ...suggestionForm, sort_order: parseInt(e.target.value) || 0 })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setShowSuggestionFor(null)}
                                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                              >
                                Annuler
                              </button>
                              <button
                                type="submit"
                                disabled={savingSuggestion}
                                className="px-3 py-1.5 text-sm bg-[#2D1B96] text-white rounded-lg hover:bg-[#231575] disabled:opacity-50 flex items-center gap-1"
                              >
                                <Save className="w-3 h-3" />
                                {savingSuggestion ? 'Ajout...' : 'Ajouter'}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <button
                            onClick={() => openSuggestionForm(criterion.id)}
                            className="text-sm text-[#2D1B96] hover:underline flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Ajouter une suggestion
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Criterion form (inline, below the list) */}
        {showCriterionForm && (
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                {editingCriterion ? `Modifier ${editingCriterion.code}` : 'Nouveau critere'}
              </h3>
              <button onClick={closeCriterionForm} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={saveCriterion} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                  <input
                    type="text"
                    required
                    value={criterionForm.code}
                    onChange={(e) => setCriterionForm({ ...criterionForm, code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                    placeholder="C1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={criterionForm.type}
                    onChange={(e) => setCriterionForm({ ...criterionForm, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                  >
                    <option value="R">R - Recommandation</option>
                    <option value="P">P - Pratique</option>
                    <option value="S">S - Securite</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ordre</label>
                  <input
                    type="number"
                    value={criterionForm.sort_order}
                    onChange={(e) => setCriterionForm({ ...criterionForm, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Libelle *</label>
                <textarea
                  required
                  rows={2}
                  value={criterionForm.label}
                  onChange={(e) => setCriterionForm({ ...criterionForm, label: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                  placeholder="Libelle du critere..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source bibliographique</label>
                <input
                  type="text"
                  value={criterionForm.source}
                  onChange={(e) => setCriterionForm({ ...criterionForm, source: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                  placeholder="Ref. bibliographique"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeCriterionForm}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingCriterion}
                  className="px-4 py-2 text-sm bg-[#2D1B96] text-white rounded-lg hover:bg-[#231575] disabled:opacity-50 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {savingCriterion ? 'Enregistrement...' : editingCriterion ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
