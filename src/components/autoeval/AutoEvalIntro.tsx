'use client'

import { Clock, Lock, ShieldAlert } from 'lucide-react'
import type { Questionnaire } from '@/lib/autoeval/types'

interface Props {
  questionnaire: Questionnaire
  onStart: () => void
}

/**
 * Écran d'accueil (section 0 bis) : durée estimée, avertissement « pas de reprise »,
 * confidentialité. Le texte vient de questionnaire.intro_text (éditable en base).
 */
export default function AutoEvalIntro({ questionnaire, onStart }: Props) {
  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h2 className="text-xl font-black text-white">Avant de commencer</h2>

      {questionnaire.intro_text && (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[#d4d4d4]">
          {questionnaire.intro_text}
        </p>
      )}

      <div className="mt-5 space-y-3">
        <div className="flex items-start gap-3 rounded-2xl border border-[#333] bg-[#1a1a1a] p-3.5">
          <Clock size={18} className="mt-0.5 flex-shrink-0 text-[#EC4899]" />
          <p className="text-xs leading-relaxed text-[#d4d4d4]">
            Comptez environ {questionnaire.time_estimate_min ?? 10} minutes, à faire d'une seule traite.
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
          <ShieldAlert size={18} className="mt-0.5 flex-shrink-0 text-amber-400" />
          <p className="text-xs leading-relaxed text-[#d4d4d4]">
            Vos réponses ne sont pas enregistrées en cours de route. Si vous quittez avant la fin,
            il faudra recommencer depuis le début.
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-[#333] bg-[#1a1a1a] p-3.5">
          <Lock size={18} className="mt-0.5 flex-shrink-0 text-[#A78BFA]" />
          <p className="text-xs leading-relaxed text-[#d4d4d4]">
            Vos réponses restent sur votre appareil et ne sont partagées avec personne. Seule la
            date de réalisation est conservée, pour votre attestation.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="mt-6 w-full rounded-2xl bg-[#EC4899] py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
      >
        Commencer
      </button>
    </div>
  )
}
