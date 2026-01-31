import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, ShieldCheck, HeartHandshake, HeartPulse,
  Home, Bell, ChevronRight, X, CheckCircle2, AlertCircle,
  Flame, Trophy, Sparkles, Play, ArrowRight, Newspaper,
  Scale, FlaskConical, Stethoscope, PartyPopper, ExternalLink
} from 'lucide-react';

// ============================================
// DENTALLEARN V3 - PAGE D'ACCUEIL (VERSION FINALE)
// Simplifiée : pas de CP visible, cartes épurées, veille métier
// Couleurs Dentalschool : #00D1C1 (turquoise) #2D1B96 (bleu profond)
// ============================================

// --- TYPES ---
interface AxisData {
  id: string;
  axeNumber: number;
  name: string;
  shortName: string;
  icon: React.ElementType;
  color: string;
  bgLight: string;
  progressFilled: number; // 0-4 (nombre de barres remplies)
  dailyDone: boolean;
  todayQuiz: {
    title: string;
  };
}

interface NewsItem {
  id: string;
  category: 'reglementaire' | 'scientifique' | 'pratique' | 'humour';
  title: string;
  source: string;
  date: string;
  externalUrl?: string;
}

interface QuizQuestion {
  id: number;
  text: string;
  isTrue: boolean;
  explanation: string;
  source?: string;
}

// --- DONNÉES MOCK ---
const axesData: AxisData[] = [
  {
    id: 'axe1',
    axeNumber: 1,
    name: 'Actualisation des connaissances',
    shortName: 'Connaissances',
    icon: GraduationCap,
    color: '#2D1B96',
    bgLight: 'bg-indigo-50',
    progressFilled: 2,
    dailyDone: false,
    todayQuiz: { title: 'CCAM 2026' }
  },
  {
    id: 'axe2',
    axeNumber: 2,
    name: 'Évaluation des pratiques',
    shortName: 'Pratiques',
    icon: ShieldCheck,
    color: '#00D1C1',
    bgLight: 'bg-teal-50',
    progressFilled: 3,
    dailyDone: true,
    todayQuiz: { title: 'Stérilisation' }
  },
  {
    id: 'axe3',
    axeNumber: 3,
    name: 'Relation patient',
    shortName: 'Relation',
    icon: HeartHandshake,
    color: '#F59E0B',
    bgLight: 'bg-amber-50',
    progressFilled: 1,
    dailyDone: false,
    todayQuiz: { title: 'Annonce diagnostic' }
  },
  {
    id: 'axe4',
    axeNumber: 4,
    name: 'Santé personnelle',
    shortName: 'Santé Pro',
    icon: HeartPulse,
    color: '#EC4899',
    bgLight: 'bg-pink-50',
    progressFilled: 0,
    dailyDone: false,
    todayQuiz: { title: 'Ergonomie' }
  }
];

const newsData: NewsItem[] = [
  {
    id: '1',
    category: 'reglementaire',
    title: 'Convention dentaire 2026 : les nouveaux tarifs opposables',
    source: 'ONCD',
    date: "Aujourd'hui"
  },
  {
    id: '2',
    category: 'scientifique',
    title: 'Efficacité comparée des techniques d\'éclaircissement : méta-analyse 2025',
    source: 'Journal of Dental Research',
    date: 'Hier'
  },
  {
    id: '3',
    category: 'pratique',
    title: '5 astuces pour optimiser votre flux de travail numérique',
    source: 'Dental Tribune',
    date: 'Il y a 2 jours'
  },
  {
    id: '4',
    category: 'humour',
    title: '😂 Les meilleures perles de patients de la semaine',
    source: '@dentiste_humour',
    date: 'Il y a 3 jours',
    externalUrl: 'https://instagram.com/dentiste_humour'
  }
];

const dailyQuizQuestions: QuizQuestion[] = [
  {
    id: 1,
    text: "Le détartrage complet peut être coté 3 fois par an pour un patient diabétique en ALD ?",
    isTrue: true,
    explanation: "Vrai. Depuis 2026, la fréquence passe à 3 fois par an pour les patients en ALD diabète, afin de prévenir les complications parodontales.",
    source: "Convention Dentaire 2026"
  },
  {
    id: 2,
    text: "La télé-expertise dentaire est opposable pour tous les patients depuis janvier 2026 ?",
    isTrue: false,
    explanation: "Faux. Elle reste conditionnée aux patients dépendants, en EHPAD ou en situation de handicap.",
    source: "Avenant 3 Convention"
  },
  {
    id: 3,
    text: "L'inlay-core fibré bénéficie d'une revalorisation de 12% ?",
    isTrue: true,
    explanation: "Vrai. Cette revalorisation encourage les techniques de restauration plus conservatrices.",
    source: "CCAM v72"
  },
  {
    id: 4,
    text: "Le code HBJD001 inclut désormais explicitement le polissage dans son libellé ?",
    isTrue: false,
    explanation: "Faux. Le libellé reste inchangé. Le polissage a toujours été considéré comme inclus.",
    source: "CCAM v72"
  }
];

// --- COMPOSANTS ---

// Navigation Bottom
const BottomNav = ({ activeTab, onNavigate }: { activeTab: string; onNavigate: (tab: string) => void }) => {
  const tabs = [
    { id: 'home', icon: Home, label: 'Accueil' },
    { id: 'axe1', icon: GraduationCap, label: 'Formation' },
    { id: 'axe2', icon: ShieldCheck, label: 'Conformité' },
    { id: 'axe3', icon: HeartHandshake, label: 'Patient' },
    { id: 'axe4', icon: HeartPulse, label: 'Santé Pro' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2 py-2 z-40">
      <div className="max-w-lg mx-auto flex justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-xl transition-all ${
                isActive 
                  ? 'bg-gradient-to-b from-[#2D1B96]/10 to-[#00D1C1]/10' 
                  : 'hover:bg-gray-50'
              }`}
            >
              <Icon 
                size={22} 
                className={isActive ? 'text-[#2D1B96]' : 'text-gray-400'}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={`text-[10px] mt-1 font-medium ${
                isActive ? 'text-[#2D1B96]' : 'text-gray-400'
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

// Barres de progression globales (4 axes, sans titre, sans %)
const GlobalProgressBars = ({ axes }: { axes: AxisData[] }) => {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="space-y-3">
        {axes.map((axis) => {
          const Icon = axis.icon;
          // 4 segments pour visualiser la progression
          const segments = [0, 1, 2, 3];
          
          return (
            <div key={axis.id} className="flex items-center gap-3">
              <div 
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${axis.bgLight}`}
                style={{ color: axis.color }}
              >
                <Icon size={16} />
              </div>
              <div className="flex-1 flex gap-1">
                {segments.map((seg) => (
                  <div 
                    key={seg}
                    className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                      seg < axis.progressFilled 
                        ? '' 
                        : 'bg-gray-100'
                    }`}
                    style={seg < axis.progressFilled ? { backgroundColor: axis.color } : {}}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Carte Entraînement simplifiée
const TrainingCard = ({ 
  axis, 
  onStartQuiz 
}: { 
  axis: AxisData; 
  onStartQuiz: (axis: AxisData) => void;
}) => {
  const Icon = axis.icon;
  
  return (
    <button
      onClick={() => !axis.dailyDone && onStartQuiz(axis)}
      disabled={axis.dailyDone}
      className={`w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left transition-all ${
        axis.dailyDone 
          ? 'opacity-75' 
          : 'hover:shadow-md hover:scale-[1.02] active:scale-[0.98]'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div 
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${axis.bgLight}`}
          style={{ color: axis.color }}
        >
          <Icon size={20} />
        </div>
        
        {axis.dailyDone ? (
          <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full">
            <CheckCircle2 size={14} />
            <span className="text-[10px] font-bold">Fait</span>
          </div>
        ) : (
          <div 
            className="flex items-center gap-1 px-2 py-1 rounded-full animate-pulse"
            style={{ backgroundColor: `${axis.color}15`, color: axis.color }}
          >
            <Sparkles size={12} />
            <span className="text-[10px] font-bold">+1 pt</span>
          </div>
        )}
      </div>
      
      <h3 className="font-bold text-gray-900 text-sm mb-1">
        {axis.shortName}
      </h3>
      <p className="text-[11px] text-gray-400">
        {axis.todayQuiz.title}
      </p>
      
      {/* Barre de progression du quiz (vide ou pleine) */}
      <div className="mt-3 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-700"
          style={{ 
            width: axis.dailyDone ? '100%' : '0%',
            backgroundColor: axis.color
          }}
        />
      </div>
    </button>
  );
};

// Section Veille Métier
const NewsSection = ({ news }: { news: NewsItem[] }) => {
  const getCategoryStyle = (category: NewsItem['category']) => {
    switch (category) {
      case 'reglementaire':
        return { icon: Scale, bg: 'bg-blue-50', text: 'text-blue-600', label: 'Réglementaire' };
      case 'scientifique':
        return { icon: FlaskConical, bg: 'bg-purple-50', text: 'text-purple-600', label: 'Scientifique' };
      case 'pratique':
        return { icon: Stethoscope, bg: 'bg-teal-50', text: 'text-teal-600', label: 'Pratique' };
      case 'humour':
        return { icon: PartyPopper, bg: 'bg-pink-50', text: 'text-pink-600', label: 'Humour' };
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Newspaper size={20} className="text-[#2D1B96]" />
          Veille métier
        </h2>
        <button className="text-xs font-bold text-[#2D1B96] flex items-center gap-1 hover:underline">
          Tout voir
          <ChevronRight size={14} />
        </button>
      </div>
      
      <div className="space-y-3">
        {news.map((item) => {
          const style = getCategoryStyle(item.category);
          const Icon = style.icon;
          const isExternal = !!item.externalUrl;
          
          return (
            <a
              key={item.id}
              href={item.externalUrl || '#'}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noopener noreferrer' : undefined}
              className="block bg-white rounded-xl p-3 shadow-sm border border-gray-100 hover:shadow-md transition-all"
            >
              <div className="flex gap-3">
                <div className={`w-10 h-10 rounded-lg ${style.bg} ${style.text} flex items-center justify-center shrink-0`}>
                  <Icon size={18} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase ${style.text}`}>
                      {style.label}
                    </span>
                    <span className="text-[10px] text-gray-300">•</span>
                    <span className="text-[10px] text-gray-400">{item.date}</span>
                  </div>
                  
                  <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 mb-1">
                    {item.title}
                  </h3>
                  
                  <div className="flex items-center gap-1 text-[10px] text-gray-400">
                    <span>{item.source}</span>
                    {isExternal && <ExternalLink size={10} />}
                  </div>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
};

// Modal Quiz Quotidien (simplifié)
const DailyQuizModal = ({ 
  axis,
  onClose, 
  onComplete 
}: { 
  axis: AxisData;
  onClose: () => void; 
  onComplete: () => void;
}) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  
  const questions = dailyQuizQuestions;
  const currentQ = questions[currentQuestion];

  const handleAnswer = (userSaysTrue: boolean) => {
    const correct = userSaysTrue === currentQ.isTrue;
    setIsCorrect(correct);
    if (correct) setScore(s => s + 1);
    setShowFeedback(true);
  };

  const nextQuestion = () => {
    setShowFeedback(false);
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(q => q + 1);
    } else {
      setIsFinished(true);
    }
  };

  // Écran de fin
  if (isFinished) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/70 backdrop-blur-sm">
        <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center relative overflow-hidden">
          {/* Confetti */}
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(15)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full animate-bounce"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 40}%`,
                  backgroundColor: [axis.color, '#00D1C1', '#F59E0B', '#EC4899'][i % 4],
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${1 + Math.random()}s`
                }}
              />
            ))}
          </div>
          
          <div className="relative z-10">
            <div 
              className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${axis.color}20` }}
            >
              <Trophy size={40} style={{ color: axis.color }} />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Bravo !
            </h2>
            <p className="text-gray-500 mb-6">
              Quiz complété • <span className="font-bold" style={{ color: axis.color }}>+1 point</span> {axis.shortName}
            </p>
            
            <div className="bg-gray-50 rounded-2xl p-4 mb-6">
              <div className="text-3xl font-black" style={{ color: axis.color }}>
                {score}/{questions.length}
              </div>
              <div className="text-xs text-gray-400 mt-1">bonnes réponses</div>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={onComplete}
                className="w-full py-3.5 bg-gradient-to-r from-[#2D1B96] to-[#00D1C1] text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
              >
                Continuer la formation
                <ArrowRight size={18} />
              </button>
              <button
                onClick={() => { onComplete(); onClose(); }}
                className="w-full py-3.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all"
              >
                Retour à l'accueil
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/70 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl relative overflow-hidden">
        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100">
          <div 
            className="h-full transition-all duration-500"
            style={{ 
              width: `${((currentQuestion + 1) / questions.length) * 100}%`,
              backgroundColor: axis.color
            }}
          />
        </div>
        
        {/* Header */}
        <div className="p-4 pb-0 flex justify-between items-start">
          <div>
            <div 
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold mb-2"
              style={{ backgroundColor: `${axis.color}15`, color: axis.color }}
            >
              <axis.icon size={14} />
              {axis.shortName}
            </div>
            <div className="text-xs text-gray-400">
              Question {currentQuestion + 1}/{questions.length}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-300 hover:text-gray-500 hover:bg-gray-50 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 pt-4">
          <h3 className="text-lg font-bold text-gray-900 leading-snug mb-6 min-h-[80px]">
            {currentQ.text}
          </h3>

          {!showFeedback ? (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleAnswer(true)}
                className="h-28 rounded-2xl bg-emerald-50 border-2 border-emerald-100 flex flex-col items-center justify-center gap-2 hover:bg-emerald-100 hover:border-emerald-300 hover:scale-[1.02] transition-all active:scale-95"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-200 text-emerald-700 flex items-center justify-center">
                  <CheckCircle2 size={28} />
                </div>
                <span className="text-lg font-black text-emerald-700">VRAI</span>
              </button>

              <button
                onClick={() => handleAnswer(false)}
                className="h-28 rounded-2xl bg-red-50 border-2 border-red-100 flex flex-col items-center justify-center gap-2 hover:bg-red-100 hover:border-red-300 hover:scale-[1.02] transition-all active:scale-95"
              >
                <div className="w-12 h-12 rounded-full bg-red-200 text-red-700 flex items-center justify-center">
                  <X size={28} />
                </div>
                <span className="text-lg font-black text-red-700">FAUX</span>
              </button>
            </div>
          ) : (
            <div className={`rounded-2xl p-5 ${isCorrect ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-full ${isCorrect ? 'bg-emerald-200 text-emerald-700' : 'bg-red-200 text-red-700'}`}>
                  {isCorrect ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                </div>
                <span className={`text-lg font-bold ${isCorrect ? 'text-emerald-800' : 'text-red-800'}`}>
                  {isCorrect ? 'Exact !' : 'À retenir'}
                </span>
              </div>
              
              <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                {currentQ.explanation}
              </p>
              
              {currentQ.source && (
                <p className="text-[11px] text-gray-400 italic mb-4">
                  {currentQ.source}
                </p>
              )}

              <button
                onClick={nextQuestion}
                className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
              >
                {currentQuestion < questions.length - 1 ? 'Suivant' : 'Voir mon score'}
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Carte Formation Premium (simplifiée)
const CurrentFormationCard = () => (
  <div className="relative bg-gradient-to-br from-[#2D1B96] to-[#1a0f5c] rounded-2xl p-5 overflow-hidden">
    <div className="absolute -top-8 -right-8 w-32 h-32 bg-[#00D1C1] opacity-20 rounded-full" />
    <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-[#00D1C1] opacity-10 rounded-full" />
    
    <div className="relative z-10">
      <span className="text-[#00D1C1] text-xs font-bold uppercase tracking-wide">
        En cours
      </span>
      
      <h3 className="text-white font-bold text-lg mb-1 mt-2 leading-tight">
        Éclaircissements & Taches Blanches
      </h3>
      <p className="text-white/60 text-xs mb-4">
        Dr Laurent Elbeze • Séquence 5/15
      </p>
      
      {/* Progress */}
      <div className="h-2 bg-white/20 rounded-full mb-4 overflow-hidden">
        <div className="h-full bg-[#00D1C1] rounded-full w-[33%]" />
      </div>
      
      <button className="flex items-center gap-2 px-4 py-2.5 bg-[#00D1C1] text-white rounded-xl text-sm font-bold hover:bg-[#00b8a9] transition-colors">
        <Play size={16} />
        Continuer
      </button>
    </div>
  </div>
);

// --- COMPOSANT PRINCIPAL ---
const DentalLearnHomeV3 = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [showDailyQuiz, setShowDailyQuiz] = useState(false);
  const [selectedAxis, setSelectedAxis] = useState<AxisData | null>(null);
  const [axes, setAxes] = useState(axesData);

  const handleStartQuiz = (axis: AxisData) => {
    setSelectedAxis(axis);
    setShowDailyQuiz(true);
  };

  const handleQuizComplete = () => {
    if (selectedAxis) {
      setAxes(prev => prev.map(a => 
        a.id === selectedAxis.id 
          ? { ...a, dailyDone: true }
          : a
      ));
    }
    setShowDailyQuiz(false);
    setSelectedAxis(null);
  };

  const dailyDoneCount = axes.filter(a => a.dailyDone).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#00D1C1] to-[#2D1B96] p-0.5">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                  <img 
                    src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop" 
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400">Bonjour,</p>
                <h1 className="text-lg font-bold text-gray-900">Dr. Martin</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Streak */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 rounded-full">
                <Flame size={16} className="text-orange-500" />
                <span className="text-sm font-bold text-orange-600">12</span>
              </div>
              
              {/* Notifications */}
              <button className="relative p-2.5 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors">
                <Bell size={20} className="text-gray-600" />
                <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Contenu */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        
        {/* Progression globale (sans titre) */}
        <GlobalProgressBars axes={axes} />
        
        {/* Entraînement du jour */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Sparkles size={20} className="text-[#00D1C1]" />
              Entraînement du jour
            </h2>
            <span className="text-xs font-bold text-gray-400">
              {dailyDoneCount}/4
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {axes.map((axis) => (
              <TrainingCard 
                key={axis.id} 
                axis={axis} 
                onStartQuiz={handleStartQuiz}
              />
            ))}
          </div>
        </section>
        
        {/* Formation en cours */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <GraduationCap size={20} className="text-[#2D1B96]" />
              Ma formation
            </h2>
            <button className="text-xs font-bold text-[#2D1B96] flex items-center gap-1 hover:underline">
              Catalogue
              <ChevronRight size={14} />
            </button>
          </div>
          
          <CurrentFormationCard />
        </section>
        
        {/* Veille Métier */}
        <NewsSection news={newsData} />
        
      </main>

      {/* Navigation */}
      <BottomNav activeTab={activeTab} onNavigate={setActiveTab} />
      
      {/* Modal Quiz */}
      {showDailyQuiz && selectedAxis && (
        <DailyQuizModal 
          axis={selectedAxis}
          onClose={() => {
            setShowDailyQuiz(false);
            setSelectedAxis(null);
          }}
          onComplete={handleQuizComplete}
        />
      )}
    </div>
  );
};

export default DentalLearnHomeV3;
