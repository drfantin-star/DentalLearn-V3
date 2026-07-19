'use client'

import React from 'react';
import type { Anamnese, Bilan, PatientInfo, RiskInput, Tooth } from '@/lib/perio/types';
import { MAX_TEETH, MAND_TEETH } from '@/lib/perio/types';
import { computeStats } from '@/lib/perio/calc';
import { sitePA } from '@/lib/perio/calc';

// ── Vue impression A4 (masquée à l'écran) ──
// Restitue le bilan complet : Anamnèse · Facteurs de risque · Sondage · Synthèse.

const ANAMNESE_FIELDS: { key: keyof Anamnese; label: string }[] = [
  { key: 'doleances', label: 'Doléances' },
  { key: 'motivations', label: 'Motivations' },
  { key: 'symptomes', label: 'Symptômes' },
  { key: 'antecedents', label: 'Antécédents' },
  { key: 'examens', label: 'Examens' },
  { key: 'specificites', label: 'Spécificités' },
  { key: 'microbiologie', label: 'Microbiologie' },
];

function PrintArch({ list, teeth, title }: { list: string[]; teeth: Record<string, Tooth>; title: string }) {
  const rows: { label: string; get: (s: { gr: number | null; pp: number | null; bop: boolean; ip: boolean }) => string }[] = [
    { label: 'PP', get: s => (s.pp ?? '') === '' ? '' : String(s.pp) },
    { label: 'BOP', get: s => (s.bop ? '•' : '') },
    { label: 'PL', get: s => (s.ip ? '•' : '') },
    { label: 'GR', get: s => (s.gr ?? '') === '' ? '' : String(s.gr) },
    { label: 'PA', get: s => s.pp === null ? '' : String(sitePA(s)) },
  ];
  return (
    <table className="print-chart">
      <thead>
        <tr>
          <th className="lbl">{title}</th>
          {list.map(t => (
            <th key={t} colSpan={3} className={teeth[t].absent ? 'absent' : ''}>{t}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(['b', 'l'] as const).map(face =>
          rows.map(r => (
            <tr key={face + r.label}>
              <td className="lbl">{face === 'b' ? 'V' : 'P/L'} {r.label}</td>
              {list.map(t =>
                teeth[t][face].map((s, i) => (
                  <td key={t + i} className={teeth[t].absent ? 'absent' : (s.pp ?? 0) > 5 && r.label === 'PP' ? 'high' : (s.pp ?? 0) > 3 && r.label === 'PP' ? 'warn' : ''}>
                    {teeth[t].absent ? '' : r.get(s)}
                  </td>
                )),
              )}
            </tr>
          )),
        )}
        <tr>
          <td className="lbl">Mob/Furc</td>
          {list.map(t => (
            <td key={t} colSpan={3}>
              {teeth[t].absent ? '' : `${teeth[t].mobility ?? ''}${teeth[t].furcation ? '/F' + teeth[t].furcation : ''}${teeth[t].pronostic ? ' ' + teeth[t].pronostic : ''}`}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

function AnamnesePrint({ anamnese }: { anamnese: Anamnese }) {
  return (
    <section className="print-section">
      <h2>Anamnèse</h2>
      <div className="print-anamnese">
        {ANAMNESE_FIELDS.map(f => (
          <div key={f.key}><b>{f.label} :</b> {anamnese[f.key] || '—'}</div>
        ))}
      </div>
    </section>
  );
}

function RiskPrint({ risk, stats }: { risk: RiskInput; stats: ReturnType<typeof computeStats> }) {
  const sc = stats.scores;
  const rows: { label: string; detail: string; score: number }[] = [
    { label: 'État général / génétique', detail: '—', score: sc.sante },
    { label: 'Tabac', detail: risk.tabacDetail || '—', score: sc.tabac },
    { label: 'Dents absentes', detail: `${stats.absentCount} dent(s)`, score: sc.abs },
    {
      label: 'Alvéolyse / âge',
      detail: risk.alveolyse !== null || risk.age !== null
        ? `${risk.alveolyse ?? '—'} % · ${risk.age ?? '—'} ans · PO/âge ${stats.poSurAge ?? '—'}`
        : '—',
      score: sc.os,
    },
    { label: 'Poches profondes', detail: `${stats.pctPPgt4} % sites PP > 4 mm`, score: sc.pp },
    { label: 'Inflammation (BOP)', detail: `${stats.bopPct} % sites`, score: sc.bop },
  ];
  return (
    <section className="print-section">
      <h2>Facteurs de risque</h2>
      <table className="print-risk">
        <thead>
          <tr><th>Facteur</th><th>Donnée clinique</th><th className="score">Score /10</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td>{r.detail}</td>
              <td className="score">{r.score}</td>
            </tr>
          ))}
          <tr className="prp-row">
            <td>Risque parodontal (PRP)</td>
            <td>Objectif après traitement : {stats.objectif} %</td>
            <td className="score">{stats.prp} %</td>
          </tr>
        </tbody>
      </table>
      {risk.commentaires && <p className="print-comment"><b>Commentaires :</b> {risk.commentaires}</p>}
    </section>
  );
}

function SynthesePrint({ stats }: { stats: ReturnType<typeof computeStats> }) {
  const c = stats.classification;
  const cascade = [
    { st: 'Présent', t: 'Accumulation microbes', v: stats.ipPct, note: '% sites avec plaque' },
    { st: 'Court terme', t: 'Inflammation', v: stats.bopPct, note: '% sites qui saignent' },
    { st: 'Long terme', t: 'Lésions', v: stats.pctPPgt4, note: '% sites PP > 4 mm' },
  ];
  return (
    <section className="print-section">
      <h2>Synthèse</h2>
      {c.localisation ? (
        <p className="print-synthese-diag">
          <b>Parodontite {c.localisation.toLowerCase()} · Stade {c.stade}{c.stadeIV ? ' ➜ IV' : ''}{c.grade ? ` · Grade ${c.grade}` : ''}</b>
          {' — '}{c.active ? 'Active (BOP ≥ 20 %)' : 'Non active (BOP < 20 %)'} · %PA&gt;3mm {stats.pctPAgt3} % · PAmax {stats.paMax} mm · PRP {stats.prp} % · Objectif {stats.objectif} %
        </p>
      ) : (
        <p className="print-synthese-diag">Sondage non renseigné — classification indisponible.</p>
      )}
      <div className="print-cascade">
        {cascade.map(step => (
          <div key={step.t}><span>{step.st}</span><b>{step.t}</b>{step.v} % — {step.note}</div>
        ))}
      </div>
    </section>
  );
}

export default function PrintView({ patient, bilan, index }: { patient: PatientInfo; bilan: Bilan; index: number }) {
  const s = computeStats(bilan);
  const c = s.classification;
  const fmt = (d: string) => (d ? new Date(d).toLocaleDateString('fr-FR') : '…………');
  return (
    <div id="print-view">
      <div className="print-header">
        <div>
          <h1>Bilan parodontal</h1>
          <p>{patient.prenom} {patient.nom} · né(e) le {fmt(patient.naissance)} · {patient.profession || ''}</p>
          <p>Praticien : {patient.praticien || '…………'} · le {fmt(bilan.date)}</p>
        </div>
        <div className="print-diag">
          {c.localisation ? (
            <>
              <strong>Parodontite {c.localisation.toLowerCase()} · Stade {c.stade}{c.stadeIV ? ' ➜ IV' : ''}{c.grade ? ` · Grade ${c.grade}` : ''}</strong>
              <span>{c.active ? 'Active' : 'Non active'} · PRP {s.prp}% · Objectif {s.objectif}%</span>
            </>
          ) : <strong>Sondage non renseigné</strong>}
        </div>
      </div>

      <AnamnesePrint anamnese={bilan.anamnese} />

      <RiskPrint risk={bilan.risk} stats={s} />

      <section className="print-section">
        <h2>Sondage</h2>
        <table className="print-indices">
          <tbody>
            <tr>
              <td>Sites : <b>{s.nSites}</b></td>
              <td>Dents abs. : <b>{s.absentCount}</b></td>
              <td>PPmax : <b>{s.ppMax}</b> mm</td>
              <td>PPmoy : <b>{s.ppMoy}</b> mm</td>
              <td>PAmax : <b>{s.paMax}</b> mm</td>
              <td>PAmoy : <b>{s.paMoy}</b> mm</td>
              <td>%BOP : <b>{s.bopPct}%</b></td>
              <td>Plaque : <b>{s.ipPct}%</b></td>
              <td>PP&gt;4 : <b>{s.sitesPPgt4}</b></td>
              <td>Cumul : <b>{s.cumulPoches}</b> mm</td>
            </tr>
          </tbody>
        </table>
        <PrintArch list={MAX_TEETH} teeth={bilan.teeth} title="MAXI" />
        <PrintArch list={MAND_TEETH} teeth={bilan.teeth} title="MAND" />
      </section>

      <SynthesePrint stats={s} />

      <p className="print-footer">PérioBilan · PP profondeur de poche · BOP saignement au sondage · PL plaque · GR récession · PA perte d'attache</p>
    </div>
  );
}
