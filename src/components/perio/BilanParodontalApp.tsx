'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PatientFile, Bilan } from '@/lib/perio/types';
import { emptyPatientFile } from '@/lib/perio/types';
import { computeStats } from '@/lib/perio/calc';
import { demoFile } from '@/lib/perio/demo';
import Charting from '@/components/perio/Charting';
import RiskPanel from '@/components/perio/RiskPanel';
import Synthesis from '@/components/perio/Synthesis';
import Anamnesis from '@/components/perio/Anamnesis';
import PrintView from '@/components/perio/PrintView';
import type { EntryMode } from '@/lib/perio/path';

const TABS = [
  { id: 'anamnese', label: 'Anamnèse' },
  { id: 'risque', label: 'Facteurs de risque' },
  { id: 'sondage', label: 'Sondage' },
  { id: 'synthese', label: 'Synthèse' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const today = () => new Date().toISOString().slice(0, 10);

// Sauvegarde fichier (.json) masquée pour l'instant — passer à true pour réactiver
const SHOW_FILE_SAVE = false;

export default function BilanParodontalApp() {
  const [file, setFile] = useState<PatientFile>(() => emptyPatientFile(today()));
  const [bi, setBi] = useState(0);
  const [tab, setTab] = useState<TabId>('anamnese');
  const [mode, setMode] = useState<EntryMode>('face');
  const importRef = useRef<HTMLInputElement>(null);

  const bilan = file.bilans[bi];
  const stats = useMemo(() => computeStats(bilan), [bilan]);

  // « Formulaire vide » = identique à l'état initial. Aucune donnée n'est stockée nulle part :
  // on compare simplement l'état React courant à un instantané pris à l'ouverture.
  const emptySnapshot = useRef<string>('');
  if (emptySnapshot.current === '') emptySnapshot.current = JSON.stringify(emptyPatientFile(today()));
  const isDirty = useMemo(() => JSON.stringify(file) !== emptySnapshot.current, [file]);

  // Confirmation native du navigateur à la fermeture/rechargement, seulement si une donnée a été saisie
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // requis par certains navigateurs pour afficher la confirmation
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const setBilan = (patch: Partial<Bilan>) => {
    setFile(f => ({
      ...f,
      bilans: f.bilans.map((b, i) => (i === bi ? { ...b, ...patch } : b)),
    }));
  };

  // Charge le cas d'exemple. Écrase les saisies en cours : on confirme si le
  // formulaire n'est pas vide (aucune donnée n'est stockée, la démo remplace le state).
  const loadDemo = () => {
    if (isDirty && !window.confirm("Charger le cas d'exemple remplacera vos saisies en cours. Continuer ?")) return;
    setFile(demoFile());
    setBi(0);
    setTab('synthese');
  };

  const exportJson = () => {
    const name = [file.patient.nom, file.patient.prenom].filter(Boolean).join('_') || 'patient';
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bilan-paro_${name}_${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = (f: File) => {
    f.text().then(txt => {
      try {
        const data = JSON.parse(txt) as PatientFile;
        if (!data.bilans?.length || !data.patient) throw new Error('format');
        setFile(data);
        setBi(0);
        setTab('synthese');
      } catch {
        window.alert("Ce fichier n'est pas un bilan PérioBilan valide.");
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800" style={{ fontFamily: "'Avenir Next', 'Segoe UI', system-ui, sans-serif" }}>
      {/* ── Barre d'app ── */}
      <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-20">
        {/* bandeau d'avertissement permanent */}
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs px-4 py-1.5 flex items-center gap-2">
          <span aria-hidden="true">⚠️</span>
          <span><b>Vos saisies ne sont pas enregistrées.</b> Exportez votre PDF avant de quitter la page.</span>
        </div>
        <div className="max-w-[1420px] mx-auto px-4 py-2.5 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 mr-2">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 to-pink-400 flex items-center justify-center text-white font-black text-sm">P</span>
            <p className="font-bold text-slate-800">PérioBilan</p>
          </div>

          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-slate-400 text-xs">Patient :</span>
            <span className="font-semibold">
              {file.patient.prenom || file.patient.nom ? `${file.patient.prenom} ${file.patient.nom}` : '—'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <input type="date" value={bilan.date} onChange={e => setBilan({ date: e.target.value })}
              className="text-xs border border-slate-200 rounded px-1.5 py-1 text-slate-600 outline-none focus:border-pink-400" />
            <button onClick={loadDemo}
              className="text-xs px-2.5 py-1.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-50" title="Charger un cas d'exemple">Exemple</button>
            {SHOW_FILE_SAVE && (
              <>
                <button onClick={() => importRef.current?.click()}
                  className="text-xs px-2 py-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                  title="Reprendre un bilan depuis un fichier de sauvegarde (.json)">Ouvrir…</button>
                <input ref={importRef} type="file" accept=".json,application/json" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
                <button onClick={exportJson}
                  className="text-xs px-2 py-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                  title="Sauvegarde technique (.json) pour reprendre la saisie plus tard">Sauver…</button>
              </>
            )}
            <button onClick={() => window.print()}
              title="S'ouvre dans la boîte d'impression : choisis « Enregistrer au format PDF »"
              className="text-xs px-3 py-1.5 rounded bg-pink-500 text-white font-semibold hover:bg-pink-600">Exporter en PDF</button>
          </div>
        </div>

        {/* onglets */}
        <div className="max-w-[1420px] mx-auto px-4 flex gap-0.5 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3.5 py-2 text-sm border-b-2 -mb-px whitespace-nowrap transition-colors ${
                tab === t.id ? 'border-pink-500 text-pink-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>{t.label}</button>
          ))}
        </div>
      </header>

      <main className="no-print max-w-[1420px] mx-auto px-4 py-5">
        {/* bandeau diagnostic permanent (hors synthèse) */}
        {tab !== 'synthese' && stats.classification.localisation && (
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-white border border-pink-200 px-4 py-2 text-sm">
            <span className="font-bold text-pink-600">
              Parodontite {stats.classification.localisation.toLowerCase()} · Stade {stats.classification.stade}
              {stats.classification.stadeIV && ' ➜ IV'}{stats.classification.grade && ` · Grade ${stats.classification.grade}`}
            </span>
            <span className="text-slate-500 text-xs">
              {stats.nSites} sites · PPmax {stats.ppMax} mm · %BOP {stats.bopPct}% · PRP {stats.prp}%
            </span>
          </div>
        )}

        {tab === 'anamnese' && (
          <Anamnesis
            patient={file.patient} anamnese={bilan.anamnese}
            onPatient={p => setFile(f => ({ ...f, patient: p }))}
            onAnamnese={a => setBilan({ anamnese: a })}
          />
        )}
        {tab === 'risque' && <RiskPanel bilan={bilan} stats={stats} onChange={r => setBilan({ risk: r })} />}
        {tab === 'sondage' && <Charting bilan={bilan} mode={mode} onMode={setMode} onChange={teeth => setBilan({ teeth })} />}
        {tab === 'synthese' && <Synthesis stats={stats} />}

        <footer className="mt-8 text-[10px] text-slate-400 leading-relaxed">
          Outil d'aide à la synthèse du bilan parodontal — ne remplace pas le jugement clinique.
          Rien n'est enregistré : en fin de bilan, <b>Exporter en PDF</b> pour archiver dans le dossier patient.
        </footer>
      </main>

      {/* vue impression */}
      <PrintView patient={file.patient} bilan={bilan} index={bi} />
    </div>
  );
}
