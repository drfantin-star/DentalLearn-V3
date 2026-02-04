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

export default function EditQuestionPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const formationId = params.id as string;
  const sequenceId = params.sequenceId as string;
  const questionId = params.questionId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [questionType, setQuestionType] = useState<QuestionType>('mcq');
  const [questionText, setQuestionText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [points, setPoints] = useState(10);
  const [feedbackCorrect, setFeedbackCorrect] = useState('');
  const [feedbackIncorrect, setFeedbackIncorrect] = useState('');

  // Options state
  const [mcqOptions, setMcqOptions] = useState<MCQOption[]>([]);
  const [matchingPairs, setMatchingPairs] = useState<MatchingPair[]>([]);
  const [orderingItems, setOrderingItems] = useState<OrderingItem[]>([]);
  const [fillBlanks, setFillBlanks] = useState<FillBlankItem[]>([]);
  const [wordBank, setWordBank] = useState<string[]>([]);
  const [caseStudyContext, setCaseStudyContext] = useState({ patient: '', chief_complaint: '' });
  const [caseStudyQuestions, setCaseStudyQuestions] = useState<CaseStudyQuestion[]>([]);

  useEffect(() => {
    loadQuestion();
  }, [questionId]);

  async function loadQuestion() {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (error || !data) {
      router.push(`/admin/formations/${formationId}/sequences/${sequenceId}`);
      return;
    }

    setQuestionType(data.question_type as QuestionType);
    setQuestionText(data.question_text);
    setImageUrl(data.image_url || '');
    setPoints(data.points);
    setFeedbackCorrect(data.feedback_correct);
    setFeedbackIncorrect(data.feedback_incorrect || '');

    // Parse options based on type
    const opts = data.options;
    switch (data.question_type) {
      case 'mcq':
      case 'mcq_image':
      case 'true_false':
      case 'checkbox':
      case 'highlight':
        if (Array.isArray(opts)) {
          setMcqOptions(opts.map((o: any) => ({
            id: o.id || generateId(),
            text: o.text,
            correct: o.correct
          })));
        }
        break;

      case 'matching':
        const pairs = opts?.pairs || opts;
        if (Array.isArray(pairs)) {
          setMatchingPairs(pairs.map((p: any) => ({
            id: p.id || generateId(),
            left: p.left,
            right: p.right
          })));
        }
        break;

      case 'ordering':
        if (Array.isArray(opts)) {
          setOrderingItems(opts.map((o: any) => ({
            id: o.id || generateId(),
            text: o.text
          })));
        }
        break;

      case 'fill_blank':
        if (opts?.blanks) {
          setFillBlanks(opts.blanks.map((b: any) => ({
            id: generateId(),
            correctAnswer: b.correctAnswer
          })));
        }
        if (opts?.wordBank) {
          setWordBank(opts.wordBank);
        }
        break;

      case 'case_study':
        if (opts?.context) {
          setCaseStudyContext(opts.context);
        }
        if (opts?.questions) {
          setCaseStudyQuestions(opts.questions.map((q: any) => ({
            id: generateId(),
            text: q.text,
            choices: q.choices?.map((c: any) => ({
              id: c.id || generateId(),
              text: c.text,
              correct: c.correct
            })) || [],
            feedback: q.feedback || ''
          })));
        }
        break;
    }

    setLoading(false);
  }

  function buildOptions(): any {
    switch (questionType) {
      case 'mcq':
      case 'mcq_image':
      case 'checkbox':
      case 'highlight':
        return mcqOptions;

      case 'true_false':
        return mcqOptions;

      case 'matching':
        return { pairs: matchingPairs };

      case 'ordering':
        return orderingItems.map((item, idx) => ({
          ...item,
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
      const response = await fetch(`/api/admin/questions/${questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        throw new Error(result.error || 'Erreur mise à jour');
      }

      router.push(`/admin/formations/${formationId}/sequences/${sequenceId}`);
    } catch (error: any) {
      alert('Erreur: ' + error.message);
      setSaving(false);
    }
  }

  // All the same handlers as NewQuestionPage
  function updateMcqOption(index: number, field: 'text' | 'correct', value: string | boolean) {
    setMcqOptions(prev => prev.map((opt, i) => {
      if (i === index) {
        if (field === 'correct' && value === true && (questionType === 'mcq' || questionType === 'mcq_image' || questionType === 'true_false')) {
          return { ...opt, correct: true };
        }
        return { ...opt, [field]: value };
      }
      if (field === 'correct' && value === true && (questionType === 'mcq' || questionType === 'mcq_image' || questionType === 'true_false')) {
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
          <h1 className="text-2xl font-bold text-gray-900">Modifier la question</h1>
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent resize-none"
              required
            />
          </div>

          {(questionType === 'mcq_image' || questionType === 'case_study') && (
            <ImageUpload
              value={imageUrl}
              onChange={setImageUrl}
              sequenceId={sequenceId}
              questionId={questionId}
              label="Image clinique"
              required={questionType === 'mcq_image'}
            />
          )}

          <div className="w-32">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Points
            </label>
            <select
              value={points}
              onChange={(e) => setPoints(parseInt(e.target.value))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg"
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

        {/* Options selon le type */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-4">
            Options de réponse
          </label>

          {/* MCQ / Checkbox / Highlight */}
          {['mcq', 'mcq_image', 'checkbox', 'highlight', 'true_false'].includes(questionType) && (
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
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
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
              {questionType !== 'true_false' && (
                <button
                  type="button"
                  onClick={addMcqOption}
                  className="flex items-center gap-2 text-sm text-[#2D1B96]"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter une option
                </button>
              )}
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
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <span className="text-gray-400">→</span>
                  <input
                    type="text"
                    value={pair.right}
                    onChange={(e) => updateMatchingPair(index, 'right', e.target.value)}
                    placeholder="Élément droit"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  {matchingPairs.length > 2 && (
                    <button type="button" onClick={() => removeMatchingPair(index)} className="p-2 text-gray-400 hover:text-red-600">
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addMatchingPair} className="flex items-center gap-2 text-sm text-[#2D1B96]">
                <Plus className="w-4 h-4" />
                Ajouter une paire
              </button>
            </div>
          )}

          {/* Ordering */}
          {questionType === 'ordering' && (
            <div className="space-y-3">
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
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  {orderingItems.length > 2 && (
                    <button type="button" onClick={() => removeOrderingItem(index)} className="p-2 text-gray-400 hover:text-red-600">
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addOrderingItem} className="flex items-center gap-2 text-sm text-[#2D1B96]">
                <Plus className="w-4 h-4" />
                Ajouter une étape
              </button>
            </div>
          )}

          {/* Fill Blank */}
          {questionType === 'fill_blank' && (
            <div className="space-y-4">
              <div>
                {fillBlanks.map((blank, index) => (
                  <div key={blank.id} className="flex items-center gap-3 mb-2">
                    <span className="text-sm text-gray-500">Trou {index + 1}:</span>
                    <input
                      type="text"
                      value={blank.correctAnswer}
                      onChange={(e) => updateFillBlank(index, e.target.value)}
                      placeholder="Réponse correcte"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                    />
                    {fillBlanks.length > 1 && (
                      <button type="button" onClick={() => removeFillBlank(index)} className="p-2 text-gray-400 hover:text-red-600">
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addFillBlank} className="flex items-center gap-2 text-sm text-[#2D1B96]">
                  <Plus className="w-4 h-4" />
                  Ajouter un trou
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Banque de mots (optionnel)</label>
                <input
                  type="text"
                  value={wordBank.join(', ')}
                  onChange={(e) => setWordBank(e.target.value.split(',').map(w => w.trim()).filter(w => w))}
                  placeholder="mot1, mot2, mot3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          )}

          {/* Case Study */}
          {questionType === 'case_study' && (
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                <h4 className="font-medium text-blue-800">Contexte</h4>
                <input
                  type="text"
                  value={caseStudyContext.patient}
                  onChange={(e) => setCaseStudyContext(prev => ({ ...prev, patient: e.target.value }))}
                  placeholder="Patient"
                  className="w-full px-4 py-2 border border-blue-200 rounded-lg"
                />
                <textarea
                  value={caseStudyContext.chief_complaint}
                  onChange={(e) => setCaseStudyContext(prev => ({ ...prev, chief_complaint: e.target.value }))}
                  rows={2}
                  placeholder="Motif de consultation"
                  className="w-full px-4 py-2 border border-blue-200 rounded-lg resize-none"
                />
              </div>

              {caseStudyQuestions.map((subQ, qIndex) => (
                <div key={subQ.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Sous-question {qIndex + 1}</h4>
                    {caseStudyQuestions.length > 1 && (
                      <button type="button" onClick={() => removeCaseStudyQuestion(qIndex)} className="text-red-500">
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={subQ.text}
                    onChange={(e) => updateCaseStudyQuestion(qIndex, 'text', e.target.value)}
                    placeholder="Texte"
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
                    placeholder="Feedback"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              ))}
              <button type="button" onClick={addCaseStudyQuestion} className="flex items-center gap-2 text-sm text-[#2D1B96]">
                <Plus className="w-4 h-4" />
                Ajouter une sous-question
              </button>
            </div>
          )}
        </div>

        {/* Feedbacks */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Feedback correct *</label>
            <textarea
              value={feedbackCorrect}
              onChange={(e) => setFeedbackCorrect(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Feedback incorrect</label>
            <textarea
              value={feedbackIncorrect}
              onChange={(e) => setFeedbackIncorrect(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none"
            />
          </div>
        </div>

        {/* Boutons */}
        <div className="flex gap-4">
          <Link
            href={`/admin/formations/${formationId}/sequences/${sequenceId}`}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-center"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-6 py-3 bg-[#2D1B96] text-white rounded-lg hover:bg-[#231575] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Enregistrer
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
