import React from 'react';
import type { Bilan, PatientInfo, Tooth } from '@/lib/perio/types';
import { MAX_TEETH, MAND_TEETH } from '@/lib/perio/types';
import { computeStats } from '@/lib/perio/calc';
import { sitePA } from '@/lib/perio/calc';

// ── Vue impression A4 (masquée à l'écran) ──

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
      {(bilan.anamnese.doleances || bilan.risk.commentaires) && (
        <p className="print-notes">
          {bilan.anamnese.doleances && <><b>Doléances :</b> {bilan.anamnese.doleances} </>}
          {bilan.risk.commentaires && <><b>Commentaires :</b> {bilan.risk.commentaires}</>}
        </p>
      )}
      <p className="print-footer">PérioBilan · PP profondeur de poche · BOP saignement au sondage · PL plaque · GR récession · PA perte d'attache</p>
    </div>
  );
}
