import React from 'react';
import type { Anamnese, PatientInfo } from '@/lib/perio/types';

const FIELDS: { key: keyof Anamnese; label: string; hint: string }[] = [
  { key: 'doleances', label: 'Doléances', hint: 'Motif de consultation exprimé par le patient' },
  { key: 'motivations', label: 'Motivations', hint: 'Attentes, demande esthétique / fonctionnelle' },
  { key: 'symptomes', label: 'Symptômes décrits', hint: 'Abcès, douleurs, saignements, mobilités, halitose, récessions…' },
  { key: 'antecedents', label: 'Antécédents', hint: 'Allergies, problèmes médicaux, antécédents familiaux, traitements en cours' },
  { key: 'examens', label: 'Examens', hint: 'Radiographies, examens complémentaires réalisés ou prescrits' },
  { key: 'specificites', label: 'Spécificités', hint: 'Phénotype, parafonctions, tartre, contrôle de plaque…' },
  { key: 'microbiologie', label: 'Microbiologie', hint: 'Prélèvements, résultats de tests bactériens' },
];

export default function Anamnesis({ patient, anamnese, onPatient, onAnamnese }: {
  patient: PatientInfo; anamnese: Anamnese;
  onPatient: (p: PatientInfo) => void; onAnamnese: (a: Anamnese) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h4 className="text-sm font-semibold text-slate-700">Patient</h4>
        <p className="text-[11px] text-slate-500 mb-3">
          🔒 Ces données ne quittent pas votre ordinateur : elles ne sont ni enregistrées ni transmises à Certily.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          {([
            ['nom', 'Nom'], ['prenom', 'Prénom'], ['naissance', 'Date de naissance'],
            ['profession', 'Profession'], ['praticien', 'Praticien traitant'], ['correspondant', 'Correspondant'],
          ] as [keyof PatientInfo, string][]).map(([k, label]) => (
            <label key={k} className="text-xs text-slate-500">
              {label}
              <input
                type={k === 'naissance' ? 'date' : 'text'}
                value={patient[k]}
                onChange={e => onPatient({ ...patient, [k]: e.target.value })}
                className="mt-0.5 w-full text-sm text-slate-800 border border-slate-200 rounded px-2 py-1.5 outline-none focus:border-pink-400"
              />
            </label>
          ))}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {FIELDS.map(f => (
          <div key={f.key} className="bg-white rounded-lg border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-700">{f.label}</h4>
            <p className="text-[10px] text-slate-400 mb-1.5">{f.hint}</p>
            <textarea
              value={anamnese[f.key]}
              onChange={e => onAnamnese({ ...anamnese, [f.key]: e.target.value })}
              rows={2}
              className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 outline-none focus:border-pink-400 resize-y"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
