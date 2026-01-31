'use client'

import React, { useState } from 'react'
import { 
  GraduationCap, ShieldCheck, HeartHandshake, HeartPulse,
  Home, Bell, ChevronRight, X, CheckCircle2, AlertCircle,
  Flame, Trophy, Sparkles, Play, ArrowRight, Newspaper,
  Scale, FlaskConical, Stethoscope, PartyPopper, ExternalLink
} from 'lucide-react'

// Types
interface AxisData {
  id: string
  shortName: string
  icon: React.ElementType
  color: string
  bgLight: string
  progressFilled: number
  dailyDone: boolean
  todayQuiz: { title: string }
}

interface NewsItem {
  id: string
  category: 'reglementaire' | 'scientifique' | 'pratique' | 'humour'
  title: string
  source: string
  date: string
  externalUrl?: string
}

interface QuizQuestion {
  id: number
  text: string
  isTrue: boolean
  explanation: string
  source?: string
}

// Data
const axesData: AxisData[] = [
  { id: 'axe1', shortName: 'Connaissances', icon: GraduationCap, color: '#2D1B96', bgLight: 'bg-indigo-50', progressFilled: 2, dailyDone: false, todayQuiz: { title: 'CCAM 2026' } },
  { id: 'axe2', shortName: 'Pratiques', icon: ShieldCheck, color: '#00D1C1', bgLight: 'bg-teal-50', progressFilled: 3, dailyDone: true, todayQuiz: { title: 'Stérilisation' } },
  { id: 'axe3', shortName: 'Relation', icon: HeartHandshake, color: '#F59E0B', bgLight: 'bg-amber-50', progressFilled: 1, dailyDone: false, todayQuiz: { title: 'Annonce diagnostic' } },
  { id: 'axe4', shortName: 'Santé Pro', icon: HeartPulse, color: '#EC4899', bgLight: 'bg-pink-50', progressFilled: 0, dailyDone: false, todayQuiz: { title: 'Ergonomie' } }
]

const newsData: NewsItem[] = [
  { id: '1', category: 'reglementaire', title: 'Convention dentaire 2026 : les nouveaux tarifs', source: 'ONCD', date: "Aujourd'hui" },
  { id: '2', category: 'scientifique', title: 'Techniques éclaircissement : méta-analyse 2025', source: 'J Dental Research', date: 'Hier' },
  { id: '3', category: 'pratique', title: '5 astuces pour votre flux numérique', source: 'Dental Tribune', date: 'Il y a 2j' },
  { id: '4', category: 'humour', title: 'Les perles patients de la semaine', source: '@dentiste_humour', date: 'Il y a 3j', externalUrl: 'https://instagram.com' }
]

const quizQuestions: QuizQuestion[] = [
  { id: 1, text: "Le détartrage peut être coté 3 fois par an pour un patient diabétique en ALD ?", isTrue: true, explanation: "Vrai. Depuis 2026, la fréquence passe à 3 fois par an pour les patients en ALD diabète.", source: "Convention 2026" },
  { id: 2, text: "La télé-expertise est opposable pour tous les patients depuis 2026 ?", isTrue: false, explanation: "Faux. Elle reste conditionnée aux patients dépendants ou en EHPAD.", source: "Avenant 3" },
  { id: 3, text: "L'inlay-core fibré bénéficie d'une revalorisation de 12% ?", isTrue: true, explanation: "Vrai. Cette revalorisation encourage les restaurations conservatrices.", source: "CCAM v72" },
  { id: 4, text: "Le code HBJD001 inclut explicitement le polissage ?", isTrue: false, explanation: "Faux. Le libellé reste inchangé.", source: "CCAM v72" }
]

// Components
function BottomNav({ activeTab, onNavigate }: { activeTab: string; onNavigate: (t: string) => void }) {
  const tabs = [
    { id: 'home', icon: Home, label: 'Accueil' },
    { id: 'formation', icon: GraduationCap, label: 'Formation' },
    { id: 'conformite', icon: ShieldCheck, label: 'Conformité' },
    { id: 'patient', icon: HeartHandshake, label: 'Patient' },
    { id: 'sante', icon: HeartPulse, label: 'Santé Pro' },
  ]
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2 py-2 z-40">
      <div className="max-w-lg mx-auto flex justify-around">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => onNavigate(tab.id)} className={`flex flex-col items-center px-3 py-1.5 rounded-xl ${activeTab === tab.id ? 'bg-indigo-50' : ''}`}>
            <tab.icon size={22} className={activeTab === tab.id ? 'text-[#2D1B96]' : 'text-gray-400'} />
            <span className={`text-[10px] mt-1 font-medium ${activeTab === tab.id ? 'text-[#2D1B96]' : 'text-gray-400'}`}>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}

function GlobalProgressBars({ axes }: { axes: AxisData[] }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="space-y-3">
        {axes.map((axis) => (
          <div key={axis.id} className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${axis.bgLight}`} style={{ color: axis.color }}>
              <axis.icon size={16} />
            </div>
            <div className="flex-1 flex gap-1">
              {[0, 1, 2, 3].map((seg) => (
                <div key={seg} className="h-2 flex-1 rounded-full" style={{ backgroundColor: seg < axis.progressFilled ? axis.color : '#F1F5F9' }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TrainingCard({ axis, onStart }: { axis: AxisData; onStart: (a: AxisData) => void }) {
  return (
    <button onClick={() => !axis.dailyDone && onStart(axis)} disabled={axis.dailyDone} className={`w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left ${axis.dailyDone ? 'opacity-75' : 'hover:shadow-md'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${axis.bgLight}`} style={{ color: axis.color }}>
          <axis.icon size={20} />
        </div>
        {axis.dailyDone ? (
          <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full">
            <CheckCircle2 size={14} />
            <span className="text-[10px] font-bold">Fait</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full animate-pulse" style={{ backgroundColor: `${axis.color}15`, color: axis.color }}>
            <Sparkles size={12} />
            <span className="text-[10px] font-bold">+1 pt</span>
          </div>
        )}
      </div>
      <h3 className="font-bold text-gray-900 text-sm mb-1">{axis.shortName}</h3>
      <p className="text-[11px] text-gray-400">{axis.todayQuiz.title}</p>
      <div className="mt-3 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: axis.dailyDone ? '100%' : '0%', backgroundColor: axis.color }} />
      </div>
    </button>
  )
}

function NewsSection({ news }: { news: NewsItem[] }) {
  const getStyle = (cat: NewsItem['category']) => {
    const styles = {
      reglementaire: { icon: Scale, bg: 'bg-blue-50', text: 'text-blue-600', label: 'Réglementaire' },
      scientifique: { icon: FlaskConical, bg: 'bg-purple-50', text: 'text-purple-600', label: 'Scientifique' },
      pratique: { icon: Stethoscope, bg: 'bg-teal-50', text: 'text-teal-600', label: 'Pratique' },
      humour: { icon: PartyPopper, bg: 'bg-pink-50', text: 'text-pink-600', label: 'Humour' }
    }
    return styles[cat]
  }
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Newspaper size={20} className="text-[#2D1B96]" />
          Veille métier
        </h2>
        <button className="text-xs font-bold text-[#2D1B96] flex items-center gap-1">Tout voir <ChevronRight size={14} /></button>
      </div>
      <div className="space-y-3">
        {news.map((item) => {
          const style = getStyle(item.category)
          return (
            <a key={item.id} href={item.externalUrl || '#'} target={item.externalUrl ? '_blank' : undefined} rel={item.externalUrl ? 'noopener noreferrer' : undefined} className="block bg-white rounded-xl p-3 shadow-sm border border-gray-100 hover:shadow-md">
              <div className="flex gap-3">
                <div className={`w-10 h-10 rounded-lg ${style.bg} ${style.text} flex items-center justify-center shrink-0`}>
                  <style.icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase ${style.text}`}>{style.label}</span>
                    <span className="text-[10px] text-gray-300">•</span>
                    <span className="text-[10px] text-gray-400">{item.date}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{item.title}</h3>
                  <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-1">
                    <span>{item.source}</span>
                    {item.externalUrl && <ExternalLink size={10} />}
                  </div>
                </div>
              </div>
            </a>
          )
        })}
      </div>
    </section>
  )
}

function CurrentFormationCard() {
  return (
    <div className="relative bg-gradient-to-br from-[#2D1B96] to-[#1A0F5C] rounded-2xl p-5 overflow-hidden">
      <div className="absolute -top-8 -right-8 w-32 h-32 bg-[#00D1C1] opacity-20 rounded-full" />
      <div className="relative z-10">
        <span className="text-[#00D1C1] text-xs font-bold uppercase">En cours</span>
        <h3 className="text-white font-bold text-lg mt-2">Éclaircissements & Taches Blanches</h3>
        <p className="text-white/60 text-xs mb-4">Dr Laurent Elbeze • Séquence 5/15</p>
        <div className="h-2 bg-white/20 rounded-full mb-4"><div className="h-full bg-[#00D1C1] rounded-full w-[33%]" /></div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-[#00D1C1] text-white rounded-xl text-sm font-bold">
          <Play size={16} /> Continuer
        </button>
      </div>
    </div>
  )
}

function QuizModal({ axis, onClose, onComplete }: { axis: AxisData; onClose: () => void; onComplete: () => void }) {
  const [current, setCurrent] = useState(0)
  const [score, setScore] = useState(0)
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [finished, setFinished] = useState(false)
  const q = quizQuestions[current]

  const answer = (val: boolean) => {
    const correct = val === q.isTrue
    setIsCorrect(correct)
    if (correct) setScore(s => s + 1)
    setShowFeedback(true)
  }

  const next = () => {
    setShowFeedback(false)
    if (current < quizQuestions.length - 1) setCurrent(c => c + 1)
    else setFinished(true)
  }

  if (finished) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/70 backdrop-blur-sm">
        <div className="bg-white w-full max-w-sm rounded-3xl p-6 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: `${axis.color}20` }}>
            <Trophy size={40} style={{ color: axis.color }} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Bravo !</h2>
          <p className="text-gray-500 mb-6">Quiz complété • <span className="font-bold" style={{ color: axis.color }}>+1 point</span></p>
          <div className="bg-gray-50 rounded-2xl p-4 mb-6">
            <div className="text-3xl font-black" style={{ color: axis.color }}>{score}/{quizQuestions.length}</div>
          </div>
          <button onClick={() => { onComplete(); onClose() }} className="w-full py-3.5 bg-gradient-to-r from-[#2D1B96] to-[#00D1C1] text-white rounded-xl font-bold">
            Retour
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/70 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden">
        <div className="h-1.5 bg-gray-100">
          <div className="h-full transition-all" style={{ width: `${((current + 1) / quizQuestions.length) * 100}%`, backgroundColor: axis.color }} />
        </div>
        <div className="p-4 flex justify-between items-start">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold" style={{ backgroundColor: `${axis.color}15`, color: axis.color }}>
              <axis.icon size={14} /> {axis.shortName}
            </div>
            <div className="text-xs text-gray-400 mt-1">Question {current + 1}/{quizQuestions.length}</div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>
        <div className="px-6 pb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6 min-h-[60px]">{q.text}</h3>
          {!showFeedback ? (
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => answer(true)} className="h-24 rounded-2xl bg-emerald-50 border-2 border-emerald-100 flex flex-col items-center justify-center gap-2">
                <CheckCircle2 size={28} className="text-emerald-600" />
                <span className="font-black text-emerald-700">VRAI</span>
              </button>
              <button onClick={() => answer(false)} className="h-24 rounded-2xl bg-red-50 border-2 border-red-100 flex flex-col items-center justify-center gap-2">
                <X size={28} className="text-red-600" />
                <span className="font-black text-red-700">FAUX</span>
              </button>
            </div>
          ) : (
            <div className={`rounded-2xl p-4 ${isCorrect ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                {isCorrect ? <CheckCircle2 size={20} className="text-emerald-600" /> : <AlertCircle size={20} className="text-red-600" />}
                <span className={`font-bold ${isCorrect ? 'text-emerald-800' : 'text-red-800'}`}>{isCorrect ? 'Exact !' : 'À retenir'}</span>
              </div>
              <p className="text-sm text-gray-700 mb-2">{q.explanation}</p>
              {q.source && <p className="text-[11px] text-gray-400 mb-3">{q.source}</p>}
              <button onClick={next} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                {current < quizQuestions.length - 1 ? 'Suivant' : 'Voir score'} <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Main
export default function HomePage() {
  const [activeTab, setActiveTab] = useState('home')
  const [showQuiz, setShowQuiz] = useState(false)
  const [selectedAxis, setSelectedAxis] = useState<AxisData | null>(null)
  const [axes, setAxes] = useState(axesData)

  const startQuiz = (axis: AxisData) => { setSelectedAxis(axis); setShowQuiz(true) }
  const completeQuiz = () => {
    if (selectedAxis) setAxes(prev => prev.map(a => a.id === selectedAxis.id ? { ...a, dailyDone: true } : a))
    setShowQuiz(false)
    setSelectedAxis(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#00D1C1] to-[#2D1B96] p-0.5">
              <div className="w-full h-full rounded-full bg-white overflow-hidden">
                <img src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop" alt="" className="w-full h-full object-cover" />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400">Bonjour,</p>
              <h1 className="text-lg font-bold text-gray-900">Dr. Martin</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 rounded-full">
              <Flame size={16} className="text-orange-500" />
              <span className="text-sm font-bold text-orange-600">12</span>
            </div>
            <button className="relative p-2.5 bg-gray-50 rounded-full">
              <Bell size={20} className="text-gray-600" />
              <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <GlobalProgressBars axes={axes} />

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Sparkles size={20} className="text-[#00D1C1]" /> Entraînement du jour
            </h2>
            <span className="text-xs font-bold text-gray-400">{axes.filter(a => a.dailyDone).length}/4</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {axes.map(axis => <TrainingCard key={axis.id} axis={axis} onStart={startQuiz} />)}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <GraduationCap size={20} className="text-[#2D1B96]" /> Ma formation
            </h2>
            <button className="text-xs font-bold text-[#2D1B96] flex items-center gap-1">Catalogue <ChevronRight size={14} /></button>
          </div>
          <CurrentFormationCard />
        </section>

        <NewsSection news={newsData} />
      </main>

      <BottomNav activeTab={activeTab} onNavigate={setActiveTab} />
      {showQuiz && selectedAxis && <QuizModal axis={selectedAxis} onClose={() => { setShowQuiz(false); setSelectedAxis(null) }} onComplete={completeQuiz} />}
    </div>
  )
}
