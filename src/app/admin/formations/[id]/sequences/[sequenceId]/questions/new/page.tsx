'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import ImageUpload from '@/components/admin/ImageUpload';
import { ArrowLeft, Save, Plus, X, GripVertical } from 'lucide-react';

type QuestionType = 'mcq' | 'true_false' | 'mcq_image' | 'checkbox' | 'highlight' | 'matching' | 'ordering' | 'fill_blank' | 'case_study';

interface MCQOption {
  id: string;
  text: string;
  correct: boolean;
}

interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

interface OrderingItem {
  id: string;
  text: string;
}

interface FillBlankItem {
  id: string;
  correctAnswer: string;
}

interface CaseStudyQuestion {
  id: string;
  text: string;
  choices: { id: string; text: string; correct: boolean }[];
  feedback: string;
}

const QUESTION_TYPES: { value: QuestionType; label: string; description: string }[] = [
  { value: 'mcq', label: 'QCM', description: '4 options, 1 correcte' },
  { value: 'true_false', label: 'Vrai/Faux', description: '2 options' },
  { value: 'mcq_image', label: 'QCM Image', description: 'QCM avec image zoomable' },
  { value: 'checkbox', label: 'Cases à cocher', description: 'Plusieurs réponses correctes' },
  { value: 'highlight', label: 'Barrer intrus', description: '1-2 intrus à identifier' },
  { value: 'matching', label: 'Association', description: 'Paires à relier' },
  { value: 'ordering', label: 'Ordonnancement', description: 'Éléments à ordonner' },
  { value: 'fill_blank', label: 'Texte à trous', description: 'Compléter les blancs' },
  { value: 'case_study', label: 'Cas clinique', description: '2-3 sous-questions liées' },
];

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export default function NewQuestionPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const formationId = params.id as string;
  const sequenceId = params.sequenceId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [questionsCount, setQuestionsCount] = useState(0);

  // Form state
  const [questionType, setQuestionType] = useState<QuestionType>('mcq');
  const [questionText, setQuestionText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [points, setPoints] = useState(10);
  const [feedbackCorrect, setFeedbackCorrect] = useState('');
  const [feedbackIncorrect, setFeedbackIncorrect] = useState('');

  // Options state by type
  const [mcqOptions, setMcqOptions] = useState<MCQOption[]>([
    { id: generateId(), text: '', correct: false },
    { id: generateId(), text: '', correct: false },
    { id: generateId(), text: '', correct: false },
    { id: generateId(), text: '', correct: false },
  ]);

  const [matchingPairs, setMatchingPairs] = useState<MatchingPair[]>([
    { id: generateId(), left: '', right: '' },
    { id: generateId(), left: '', right: '' },
    { id: generateId(), left: '', right: '' },
  ]);

  const [orderingItems, setOrderingItems] = useState<OrderingItem[]>([
    { id: generateId(), text: '' },
    { id: generateId(), text: '' },
    { id: generateId(), text: '' },
  ]);

  const [fillBlanks, setFillBlanks] = useState<FillBlankItem[]>([
    { id: generateId(), correctAnswer: '' },
  ]);
  const [wordBank, setWordBank] = useState<string[]>([]);

  const [caseStudyContext, setCaseStudyContext] = useState({ patient: '', chief_complaint: '' });
  const [caseStudyQuestions, setCaseStudyQuestions] = useState<CaseStudyQuestion[]>([
    {
      id: generateId(),
      text: '',
      choices: [
        { id: generateId(), text: '', correct: false },
        { id: generateId(), text: '', correct: false },
        { id: generateId(), text: '', correct: false },
      ],
      feedback: ''
    }
  ]);

  useEffect(() => {
    loadData();
  }, [sequenceId]);

  async function loadData() {
    const { count } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('sequence_id', sequenceId);

    setQuestionsCount(count || 0);
    setLoading(false);
  }

  function buildOptions(): any {
    switch (questionType) {
      case 'mcq':
      case 'mcq_image':
      case 'checkbox':
      case 'highlight':
        return mcqOptions.map((opt, idx) => ({
          id: opt.id,
          text: opt.text,
          correct: opt.correct
        }));

      case 'true_false':
        return [
          { id: '1', text: 'Vrai', correct: mcqOptions[0]?.correct || false },
          { id: '2', text: 'Faux', correct: !mcqOptions[0]?.correct }
        ];

      case 'matching':
        return { pairs: matchingPairs };

      case 'ordering':
        return orderingItems.map((item, idx) => ({
          id: item.id,
          text: item.text,
          correctPosition: idx + 1
        }));

      case 'fill_blank':
        return {
          blanks: fillBlanks.map(b => ({ correctAnswer: b.correctAnswer })),
          wordBank: wordBank.length > 0 ? wordBank : undefined
        };

      case 'case_study':
        return {
          context: caseStudyContext,
          questions: caseStudyQuestions.map(q => ({
            text: q.text,
            choices: q.choices,
            feedback: q.feedback
          }))
        };

      default:
        return [];
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!questionText.trim()) {
      alert('Le texte de la question est requis');
      return;
    }

    if (!feedbackCorrect.trim()) {
      alert('Le feedback correct est requis');
      return;
    }

    setSaving(true);

    const options = buildOptions();

    try {
      const response = await fetch('/api/admin/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sequence_id: sequenceId,
          question_order: questionsCount + 1,
          question_type: questionType,
          question_text: questionText.trim(),
          options,
          feedback_correct: feedbackCorrect.trim(),
          feedback_incorrect: feedbackIncorrect.trim(),
          image_url: imageUrl || null,
          points
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur création');
      }

      router.push(`/admin/formations/${formationId}/sequences/${sequenceId}`);
    } catch (error: any) {
      alert('Erreur: ' + error.message);
      setSaving(false);
    }
  }

  // Handlers for MCQ options
  function updateMcqOption(index: number, field: 'text' | 'correct', value: string | boolean) {
    setMcqOptions(prev => prev.map((opt, i) => {
      if (i === index) {
        if (field === 'correct' && value === true && (questionType === 'mcq' || questionType === 'mcq_image' || questionType === 'true_false')) {
          // Pour MCQ simple, une seule réponse correcte
          return { ...opt, correct: true };
        }
        return { ...opt, [field]: value };
      }
      if (field === 'correct' && value === true && (questionType === 'mcq' || questionType === 'mcq_image' || questionType === 'true_false')) {
        // Désélectionner les autres
        return { ...opt, correct: false };
      }
      return opt;
    }));
  }

  function addMcqOption() {
    setMcqOptions(prev => [...prev, { id: generateId(), text: '', correct: false }]);
  }

  function removeMcqOption(index: number) {
    if (mcqOptions.length <= 2) return;
    setMcqOptions(prev => prev.filter((_, i) => i !== index));
  }

  // Handlers for Matching
  function updateMatchingPair(index: number, field: 'left' | 'right', value: string) {
    setMatchingPairs(prev => prev.map((pair, i) =>
      i === index ? { ...pair, [field]: value } : pair
    ));
  }

  function addMatchingPair() {
    setMatchingPairs(prev => [...prev, { id: generateId(), left: '', right: '' }]);
  }

  function removeMatchingPair(index: number) {
    if (matchingPairs.length <= 2) return;
    setMatchingPairs(prev => prev.filter((_, i) => i !== index));
  }

  // Handlers for Ordering
  function updateOrderingItem(index: number, value: string) {
    setOrderingItems(prev => prev.map((item, i) =>
      i === index ? { ...item, text: value } : item
    ));
  }

  function addOrderingItem() {
    setOrderingItems(prev => [...prev, { id: generateId(), text: '' }]);
  }

  function removeOrderingItem(index: number) {
    if (orderingItems.length <= 2) return;
    setOrderingItems(prev => prev.filter((_, i) => i !== index));
  }

  // Handlers for Fill Blank
  function updateFillBlank(index: number, value: string) {
    setFillBlanks(prev => prev.map((item, i) =>
      i === index ? { ...item, correctAnswer: value } : item
    ));
  }

  function addFillBlank() {
    setFillBlanks(prev => [...prev, { id: generateId(), correctAnswer: '' }]);
  }

  function removeFillBlank(index: number) {
    if (fillBlanks.length <= 1) return;
    setFillBlanks(prev => prev.filter((_, i) => i !== index));
  }

  // Handlers for Case Study
  function addCaseStudyQuestion() {
    setCaseStudyQuestions(prev => [...prev, {
      id: generateId(),
      text: '',
      choices: [
        { id: generateId(), text: '', correct: false },
        { id: generateId(), text: '', correct: false },
        { id: generateId(), text: '', correct: false },
      ],
      feedback: ''
    }]);
  }

  function removeCaseStudyQuestion(index: number) {
    if (caseStudyQuestions.length <= 1) return;
    setCaseStudyQuestions(prev => prev.filter((_, i) => i !== index));
  }

  function updateCaseStudyQuestion(qIndex: number, field: string, value: any) {
    setCaseStudyQuestions(prev => prev.map((q, i) =>
      i === qIndex ? { ...q, [field]: value } : q
    ));
  }

  function updateCaseStudyChoice(qIndex: number, cIndex: number, field: 'text' | 'correct', value: string | boolean) {
    setCaseStudyQuestions(prev => prev.map((q, qi) => {
      if (qi !== qIndex) return q;
      return {
        ...q,
        choices: q.choices.map((c, ci) => {
          if (ci === cIndex) {
            if (field === 'correct' && value === true) {
              return { ...c, correct: true };
            }
            return { ...c, [field]: value };
          }
          if (field === 'correct' && value === true) {
            return { ...c, correct: false };
          }
          return c;
        })
      };
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D1B96]"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={`/admin/formations/${formationId}/sequences/${sequenceId}`}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouvelle question</h1>
          <p className="text-gray-500">Question {questionsCount + 1}/4</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type de question */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Type de question
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {QUESTION_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setQuestionType(type.value)}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  questionType === type.value
                    ? 'border-[#2D1B96] bg-[#2D1B96]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium text-gray-900">{type.label}</p>
                <p className="text-xs text-gray-500">{type.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Texte de la question */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Texte de la question *
            </label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={3}
              placeholder="Ex: Quel est le pourcentage de peroxyde d'hydrogène recommandé pour un éclaircissement en cabinet ?"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent resize-none"
              required
            />
          </div>

          {/* Image (pour mcq_image et case_study) */}
          {(questionType === 'mcq_image' || questionType === 'case_study') && (
            <ImageUpload
              value={imageUrl}
              onChange={setImageUrl}
              sequenceId={sequenceId}
              label="Image clinique"
              required={questionType === 'mcq_image'}
            />
          )}

          {/* Points */}
          <div className="flex gap-4">
            <div className="w-32">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Points
              </label>
              <select
                value={points}
                onChange={(e) => setPoints(parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
              >
                <option value={5}>5 pts</option>
                <option value={10}>10 pts</option>
                <option value={15}>15 pts</option>
                <option value={20}>20 pts</option>
                <option value={25}>25 pts</option>
                <option value={30}>30 pts</option>
              </select>
            </div>
          </div>
        </div>

        {/* Options selon le type */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-4">
            Options de réponse
          </label>

          {/* MCQ / Checkbox / Highlight */}
          {['mcq', 'mcq_image', 'checkbox', 'highlight'].includes(questionType) && (
            <div className="space-y-3">
              {mcqOptions.map((option, index) => (
                <div key={option.id} className="flex items-center gap-3">
                  <input
                    type={questionType === 'checkbox' ? 'checkbox' : 'radio'}
                    name="correct"
                    checked={option.correct}
                    onChange={() => updateMcqOption(index, 'correct', !option.correct)}
                    className="w-5 h-5 text-[#2D1B96]"
                  />
                  <input
                    type="text"
                    value={option.text}
                    onChange={(e) => updateMcqOption(index, 'text', e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                  />
                  {mcqOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeMcqOption(index)}
                      className="p-2 text-gray-400 hover:text-red-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addMcqOption}
                className="flex items-center gap-2 text-sm text-[#2D1B96] hover:text-[#231575]"
              >
                <Plus className="w-4 h-4" />
                Ajouter une option
              </button>
              <p className="text-xs text-gray-500 mt-2">
                {questionType === 'mcq' || questionType === 'mcq_image'
                  ? 'Sélectionnez LA bonne réponse'
                  : questionType === 'checkbox'
                  ? 'Sélectionnez TOUTES les bonnes réponses'
                  : 'Les options NON cochées sont les intrus à barrer'}
              </p>
            </div>
          )}

          {/* True/False */}
          {questionType === 'true_false' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="trueFalse"
                  checked={mcqOptions[0]?.correct === true}
                  onChange={() => setMcqOptions([
                    { id: '1', text: 'Vrai', correct: true },
                    { id: '2', text: 'Faux', correct: false }
                  ])}
                  className="w-5 h-5 text-[#2D1B96]"
                />
                <span className="text-gray-700">Vrai</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="trueFalse"
                  checked={mcqOptions[0]?.correct === false}
                  onChange={() => setMcqOptions([
                    { id: '1', text: 'Vrai', correct: false },
                    { id: '2', text: 'Faux', correct: true }
                  ])}
                  className="w-5 h-5 text-[#2D1B96]"
                />
                <span className="text-gray-700">Faux</span>
              </div>
            </div>
          )}

          {/* Matching */}
          {questionType === 'matching' && (
            <div className="space-y-3">
              {matchingPairs.map((pair, index) => (
                <div key={pair.id} className="flex items-center gap-3">
                  <GripVertical className="w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={pair.left}
                    onChange={(e) => updateMatchingPair(index, 'left', e.target.value)}
                    placeholder="Élément gauche"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                  />
                  <span className="text-gray-400">→</span>
                  <input
                    type="text"
                    value={pair.right}
                    onChange={(e) => updateMatchingPair(index, 'right', e.target.value)}
                    placeholder="Élément droit"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                  />
                  {matchingPairs.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeMatchingPair(index)}
                      className="p-2 text-gray-400 hover:text-red-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addMatchingPair}
                className="flex items-center gap-2 text-sm text-[#2D1B96] hover:text-[#231575]"
              >
                <Plus className="w-4 h-4" />
                Ajouter une paire
              </button>
            </div>
          )}

          {/* Ordering */}
          {questionType === 'ordering' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 mb-2">
                L'ordre dans lequel vous saisissez les éléments est l'ordre correct
              </p>
              {orderingItems.map((item, index) => (
                <div key={item.id} className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-[#2D1B96] text-white rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={item.text}
                    onChange={(e) => updateOrderingItem(index, e.target.value)}
                    placeholder={`Étape ${index + 1}`}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                  />
                  {orderingItems.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOrderingItem(index)}
                      className="p-2 text-gray-400 hover:text-red-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addOrderingItem}
                className="flex items-center gap-2 text-sm text-[#2D1B96] hover:text-[#231575]"
              >
                <Plus className="w-4 h-4" />
                Ajouter une étape
              </button>
            </div>
          )}

          {/* Fill Blank */}
          {questionType === 'fill_blank' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-2">
                  Utilisez [BLANK] dans le texte de la question pour indiquer les trous
                </p>
                {fillBlanks.map((blank, index) => (
                  <div key={blank.id} className="flex items-center gap-3 mb-2">
                    <span className="text-sm text-gray-500">Trou {index + 1}:</span>
                    <input
                      type="text"
                      value={blank.correctAnswer}
                      onChange={(e) => updateFillBlank(index, e.target.value)}
                      placeholder="Réponse correcte"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                    />
                    {fillBlanks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFillBlank(index)}
                        className="p-2 text-gray-400 hover:text-red-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addFillBlank}
                  className="flex items-center gap-2 text-sm text-[#2D1B96] hover:text-[#231575]"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter un trou
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Banque de mots (optionnel, pour mode boutons)
                </label>
                <input
                  type="text"
                  value={wordBank.join(', ')}
                  onChange={(e) => setWordBank(e.target.value.split(',').map(w => w.trim()).filter(w => w))}
                  placeholder="mot1, mot2, mot3 (séparés par des virgules)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Si vide, l'utilisateur devra saisir la réponse
                </p>
              </div>
            </div>
          )}

          {/* Case Study */}
          {questionType === 'case_study' && (
            <div className="space-y-6">
              {/* Contexte */}
              <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                <h4 className="font-medium text-blue-800">Contexte du cas clinique</h4>
                <div>
                  <label className="block text-sm text-blue-700 mb-1">Patient</label>
                  <input
                    type="text"
                    value={caseStudyContext.patient}
                    onChange={(e) => setCaseStudyContext(prev => ({ ...prev, patient: e.target.value }))}
                    placeholder="Ex: Femme de 45 ans"
                    className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-blue-700 mb-1">Motif de consultation</label>
                  <textarea
                    value={caseStudyContext.chief_complaint}
                    onChange={(e) => setCaseStudyContext(prev => ({ ...prev, chief_complaint: e.target.value }))}
                    rows={2}
                    placeholder="Ex: Souhaite améliorer la couleur de ses dents"
                    className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>

              {/* Sous-questions */}
              {caseStudyQuestions.map((subQ, qIndex) => (
                <div key={subQ.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">Sous-question {qIndex + 1}</h4>
                    {caseStudyQuestions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCaseStudyQuestion(qIndex)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={subQ.text}
                    onChange={(e) => updateCaseStudyQuestion(qIndex, 'text', e.target.value)}
                    placeholder="Texte de la sous-question"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <div className="space-y-2">
                    {subQ.choices.map((choice, cIndex) => (
                      <div key={choice.id} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`case_${qIndex}`}
                          checked={choice.correct}
                          onChange={() => updateCaseStudyChoice(qIndex, cIndex, 'correct', true)}
                          className="w-4 h-4"
                        />
                        <input
                          type="text"
                          value={choice.text}
                          onChange={(e) => updateCaseStudyChoice(qIndex, cIndex, 'text', e.target.value)}
                          placeholder={`Choix ${cIndex + 1}`}
                          className="flex-1 px-3 py-1 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={subQ.feedback}
                    onChange={(e) => updateCaseStudyQuestion(qIndex, 'feedback', e.target.value)}
                    placeholder="Feedback pour cette sous-question"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={addCaseStudyQuestion}
                className="flex items-center gap-2 text-sm text-[#2D1B96] hover:text-[#231575]"
              >
                <Plus className="w-4 h-4" />
                Ajouter une sous-question
              </button>
            </div>
          )}
        </div>

        {/* Feedbacks */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Feedback (bonne réponse) *
            </label>
            <textarea
              value={feedbackCorrect}
              onChange={(e) => setFeedbackCorrect(e.target.value)}
              rows={3}
              placeholder="Explication pédagogique affichée quand l'utilisateur répond correctement"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent resize-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Feedback (mauvaise réponse)
            </label>
            <textarea
              value={feedbackIncorrect}
              onChange={(e) => setFeedbackIncorrect(e.target.value)}
              rows={3}
              placeholder="Explication pédagogique affichée quand l'utilisateur se trompe (optionnel)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Boutons */}
        <div className="flex gap-4">
          <Link
            href={`/admin/formations/${formationId}/sequences/${sequenceId}`}
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
                Créer la question
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
