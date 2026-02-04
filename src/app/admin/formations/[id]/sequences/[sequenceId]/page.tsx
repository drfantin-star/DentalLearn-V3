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
  ChevronUp,
  GripVertical,
  CheckCircle,
  XCircle,
  Image as ImageIcon
} from 'lucide-react';

interface Question {
  id: string;
  sequence_id: string;
  question_order: number;
  question_type: string;
  question_text: string;
  options: any;
  feedback_correct: string;
  feedback_incorrect: string;
  image_url: string | null;
  points: number;
}

interface Sequence {
  id: string;
  formation_id: string;
  sequence_number: number;
  title: string;
  estimated_duration_minutes: number;
  learning_objectives: string[];
}

interface Formation {
  id: string;
  title: string;
}

export default function SequenceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const formationId = params.id as string;
  const sequenceId = params.sequenceId as string;

  const [formation, setFormation] = useState<Formation | null>(null);
  const [sequence, setSequence] = useState<Sequence | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [formationId, sequenceId]);

  async function loadData() {
    setLoading(true);

    // Charger la formation
    const { data: formationData } = await supabase
      .from('formations')
      .select('id, title')
      .eq('id', formationId)
      .single();

    if (formationData) setFormation(formationData);

    // Charger la séquence
    const { data: sequenceData } = await supabase
      .from('sequences')
      .select('*')
      .eq('id', sequenceId)
      .single();

    if (sequenceData) setSequence(sequenceData);

    // Charger les questions
    const { data: questionsData } = await supabase
      .from('questions')
      .select('*')
      .eq('sequence_id', sequenceId)
      .order('question_order', { ascending: true });

    if (questionsData) setQuestions(questionsData);

    setLoading(false);
  }

  function toggleQuestion(questionId: string) {
    setExpandedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  }

  async function handleDeleteQuestion(questionId: string) {
    if (!confirm('Supprimer cette question ?')) return;

    setDeleting(questionId);

    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', questionId);

    if (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    } else {
      setQuestions(questions.filter(q => q.id !== questionId));
    }

    setDeleting(null);
  }

  function getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      mcq: 'QCM',
      true_false: 'Vrai/Faux',
      mcq_image: 'QCM Image',
      checkbox: 'Cases à cocher',
      highlight: 'Barrer intrus',
      matching: 'Association',
      ordering: 'Ordonnancement',
      fill_blank: 'Texte à trous',
      case_study: 'Cas clinique',
      drag_drop: 'Glisser-déposer'
    };
    return labels[type] || type;
  }

  function getTypeColor(type: string): string {
    const colors: Record<string, string> = {
      mcq: 'bg-blue-100 text-blue-700',
      true_false: 'bg-green-100 text-green-700',
      mcq_image: 'bg-purple-100 text-purple-700',
      checkbox: 'bg-orange-100 text-orange-700',
      highlight: 'bg-red-100 text-red-700',
      matching: 'bg-cyan-100 text-cyan-700',
      ordering: 'bg-amber-100 text-amber-700',
      fill_blank: 'bg-pink-100 text-pink-700',
      case_study: 'bg-indigo-100 text-indigo-700',
      drag_drop: 'bg-teal-100 text-teal-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  }

  function renderOptions(question: Question) {
    const { question_type, options } = question;

    if (!options) return <p className="text-gray-500 text-sm">Aucune option</p>;

    switch (question_type) {
      case 'mcq':
      case 'mcq_image':
      case 'true_false':
      case 'checkbox':
      case 'highlight':
        if (Array.isArray(options)) {
          return (
            <ul className="space-y-2">
              {options.map((opt: any, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  {opt.correct ? (
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  )}
                  <span className={opt.correct ? 'text-green-700 font-medium' : 'text-gray-600'}>
                    {opt.text}
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        break;

      case 'matching':
        const pairs = options.pairs || options;
        if (Array.isArray(pairs)) {
          return (
            <div className="space-y-2">
              {pairs.map((pair: any, idx: number) => (
                <div key={idx} className="flex items-center gap-3 bg-gray-50 p-2 rounded">
                  <span className="font-medium text-gray-700">{pair.left}</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-gray-600">{pair.right}</span>
                </div>
              ))}
            </div>
          );
        }
        break;

      case 'ordering':
        if (Array.isArray(options)) {
          return (
            <ol className="space-y-2">
              {options.map((opt: any, idx: number) => (
                <li key={idx} className="flex items-center gap-3 bg-gray-50 p-2 rounded">
                  <span className="w-6 h-6 bg-[#2D1B96] text-white rounded-full flex items-center justify-center text-sm font-medium">
                    {idx + 1}
                  </span>
                  <span className="text-gray-700">{opt.text}</span>
                </li>
              ))}
            </ol>
          );
        }
        break;

      case 'fill_blank':
        return (
          <div className="space-y-3">
            {options.blanks && (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Réponses correctes :</p>
                <div className="flex flex-wrap gap-2">
                  {options.blanks.map((blank: any, idx: number) => (
                    <span key={idx} className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">
                      {blank.correctAnswer}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {options.wordBank && options.wordBank.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Banque de mots :</p>
                <div className="flex flex-wrap gap-2">
                  {options.wordBank.map((word: string, idx: number) => (
                    <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm">
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'case_study':
        return (
          <div className="space-y-4">
            {options.context && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-blue-800">Patient : {options.context.patient}</p>
                <p className="text-sm text-blue-700">{options.context.chief_complaint}</p>
              </div>
            )}
            {options.questions && (
              <div className="space-y-3">
                {options.questions.map((subQ: any, idx: number) => (
                  <div key={idx} className="border-l-2 border-gray-200 pl-3">
                    <p className="font-medium text-gray-800 text-sm">{idx + 1}. {subQ.text}</p>
                    <ul className="mt-1 space-y-1">
                      {subQ.choices?.map((choice: any, cIdx: number) => (
                        <li key={cIdx} className={`text-sm ${choice.correct ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                          {choice.correct ? '✓' : '○'} {choice.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">{JSON.stringify(options, null, 2)}</pre>;
    }

    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D1B96]"></div>
      </div>
    );
  }

  if (!sequence) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Séquence non trouvée</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/admin/formations/${formationId}`}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <p className="text-sm text-gray-500">{formation?.title}</p>
          <h1 className="text-2xl font-bold text-gray-900">
            Séquence {sequence.sequence_number} : {sequence.title}
          </h1>
        </div>
        <Link
          href={`/admin/formations/${formationId}/sequences/${sequenceId}/edit`}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
        >
          <Edit className="w-4 h-4" />
          Modifier
        </Link>
      </div>

      {/* Info séquence */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-sm text-gray-500">Durée</p>
            <p className="font-medium">{sequence.estimated_duration_minutes} minutes</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Questions</p>
            <p className={`font-medium ${questions.length === 4 ? 'text-green-600' : 'text-orange-600'}`}>
              {questions.length}/4
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Points total</p>
            <p className="font-medium">{questions.reduce((sum, q) => sum + q.points, 0)} pts</p>
          </div>
        </div>

        {sequence.learning_objectives && sequence.learning_objectives.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-2">Objectifs pédagogiques :</p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              {sequence.learning_objectives.map((obj, idx) => (
                <li key={idx}>{obj}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Questions */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Questions</h2>
            <p className="text-sm text-gray-500">
              {questions.length} question{questions.length > 1 ? 's' : ''} • Objectif: 4 questions
            </p>
          </div>
          <Link
            href={`/admin/formations/${formationId}/sequences/${sequenceId}/questions/new`}
            className="px-4 py-2 bg-[#2D1B96] text-white rounded-lg hover:bg-[#231575] transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </Link>
        </div>

        {questions.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 mb-4">Aucune question dans cette séquence</p>
            <Link
              href={`/admin/formations/${formationId}/sequences/${sequenceId}/questions/new`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#2D1B96] text-white rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Créer la première question
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {questions.map((question) => (
              <div key={question.id} className="p-4">
                {/* Question header */}
                <div
                  className="flex items-start gap-4 cursor-pointer"
                  onClick={() => toggleQuestion(question.id)}
                >
                  <div className="p-2 text-gray-400">
                    <GripVertical className="w-5 h-5" />
                  </div>

                  <div className="w-8 h-8 bg-[#2D1B96] text-white rounded-lg flex items-center justify-center font-bold text-sm">
                    {question.question_order}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(question.question_type)}`}>
                        {getTypeLabel(question.question_type)}
                      </span>
                      <span className="text-xs text-gray-500">{question.points} pts</span>
                      {question.image_url && (
                        <ImageIcon className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <p className="text-gray-900 line-clamp-2">{question.question_text}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/formations/${formationId}/sequences/${sequenceId}/questions/${question.id}/edit`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit className="w-5 h-5" />
                    </Link>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteQuestion(question.id);
                      }}
                      disabled={deleting === question.id}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      {deleting === question.id ? (
                        <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-5 h-5" />
                      )}
                    </button>
                    {expandedQuestions.has(question.id) ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Question details (expanded) */}
                {expandedQuestions.has(question.id) && (
                  <div className="mt-4 ml-16 space-y-4 border-t border-gray-100 pt-4">
                    {/* Image */}
                    {question.image_url && (
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-2">Image :</p>
                        <img
                          src={question.image_url}
                          alt="Question"
                          className="max-w-xs rounded-lg border border-gray-200"
                        />
                      </div>
                    )}

                    {/* Options */}
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">Options :</p>
                      {renderOptions(question)}
                    </div>

                    {/* Feedbacks */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-green-50 p-3 rounded-lg">
                        <p className="text-sm font-medium text-green-700 mb-1">✓ Feedback correct</p>
                        <p className="text-sm text-green-800">{question.feedback_correct}</p>
                      </div>
                      {question.feedback_incorrect && (
                        <div className="bg-red-50 p-3 rounded-lg">
                          <p className="text-sm font-medium text-red-700 mb-1">✗ Feedback incorrect</p>
                          <p className="text-sm text-red-800">{question.feedback_incorrect}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alerte si pas assez de questions */}
      {questions.length < 4 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-orange-800 font-medium">
            ⚠️ Il manque {4 - questions.length} question{4 - questions.length > 1 ? 's' : ''} pour compléter cette séquence
          </p>
        </div>
      )}

      {questions.length === 4 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-green-800 font-medium">
            ✓ Séquence complète (4 questions)
          </p>
        </div>
      )}
    </div>
  );
}
