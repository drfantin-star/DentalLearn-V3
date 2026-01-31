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
