'use client';

import { useMemo } from 'react';
import { axeHex } from '@/lib/cp/axeColors';

interface RadarCPProps {
  ordreInscriptionDate: string | null;
  actionsParAxe: {
    axe1: number;
    axe2: number;
    axe3: number;
    axe4: number;
  };
  /** Années civiles où une auto-évaluation santé (axe 4) a été réalisée. */
  autoevalYears?: number[];
}

export default function RadarCP({ ordreInscriptionDate, actionsParAxe, autoevalYears }: RadarCPProps) {

  // Calcul de la periode de certification
  const periode = useMemo(() => {
    const ordreDate = ordreInscriptionDate ? new Date(ordreInscriptionDate) : null;
    const seuil2023 = new Date('2023-01-01');

    if (!ordreDate || ordreDate < seuil2023) {
      // Inscrit avant 2023 -> derogation 9 ans (2023-2032)
      return {
        debut: new Date('2023-01-01'),
        fin: new Date('2032-12-31'),
        dureeAns: 9,
        isDerogation: true
      };
    } else {
      // Inscrit apres 2023 -> 6 ans a partir de l'inscription
      const fin = new Date(ordreDate);
      fin.setFullYear(fin.getFullYear() + 6);
      return {
        debut: ordreDate,
        fin: fin,
        dureeAns: 6,
        isDerogation: false
      };
    }
  }, [ordreInscriptionDate]);

  // Calcul du temps restant
  const tempsRestant = useMemo(() => {
    const now = new Date();
    const diffMs = periode.fin.getTime() - now.getTime();
    const diffJours = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const diffMois = Math.ceil(diffJours / 30);
    const diffAns = Math.floor(diffMois / 12);
    const moisRestants = diffMois % 12;

    return {
      jours: diffJours,
      mois: diffMois,
      ans: diffAns,
      moisRestants,
      pourcentageEcoule: Math.min(100, Math.max(0,
        ((now.getTime() - periode.debut.getTime()) /
        (periode.fin.getTime() - periode.debut.getTime())) * 100
      ))
    };
  }, [periode]);

  // Sous-ligne axe 4 : une pastille par année civile de la période CP (bornes du
  // radar), pleine si l'auto-évaluation santé a été réalisée cette année-là.
  const autoevalSet = useMemo(() => new Set(autoevalYears ?? []), [autoevalYears]);
  const anneesPeriode = useMemo(() => {
    const start = periode.debut.getFullYear();
    const end = periode.fin.getFullYear();
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [periode]);
  const anneeCourante = new Date().getFullYear();

  // Objectif : 2 actions minimum par axe
  const OBJECTIF_PAR_AXE = 2;

  const axes = [
    { id: 'axe1', label: 'Competences', color: axeHex(1), icon: '📚', count: actionsParAxe.axe1 },
    { id: 'axe2', label: 'Qualite pratiques', color: axeHex(2), icon: '📋', count: actionsParAxe.axe2 },
    { id: 'axe3', label: 'Relation patient', color: axeHex(3), icon: '🤝', count: actionsParAxe.axe3 },
    { id: 'axe4', label: 'Sante praticien', color: axeHex(4), icon: '❤️', count: actionsParAxe.axe4 },
  ];

  const totalActions = Object.values(actionsParAxe).reduce((a, b) => a + b, 0);
  const totalObjectif = OBJECTIF_PAR_AXE * 4; // 8 actions minimum

  return (
    <div className="glass-card rounded-2xl overflow-hidden">

      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-accent px-4 py-3 glow-accent">
        <h3 className="text-white font-bold text-sm">Certification Periodique</h3>
        <p className="text-white/70 text-xs">
          {periode.isDerogation ? 'Premier cycle (derogation 9 ans)' : 'Cycle standard (6 ans)'}
        </p>
      </div>

      <div className="p-4 space-y-4">

        {/* Barre de progression temporelle */}
        <div>
          <div className="flex justify-between text-xs text-white/55 mb-1.5">
            <span>{periode.debut.getFullYear()}</span>
            <span className="font-semibold text-white/70">
              {tempsRestant.ans > 0
                ? `${tempsRestant.ans} an${tempsRestant.ans > 1 ? 's' : ''}${tempsRestant.moisRestants > 0 ? ` et ${tempsRestant.moisRestants} mois` : ''} restants`
                : `${tempsRestant.mois} mois restants`}
            </span>
            <span>{periode.fin.getFullYear()}</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
              style={{ width: `${tempsRestant.pourcentageEcoule}%` }}
            />
          </div>
        </div>

        {/* Liste compacte axes.
            Mobile : liste verticale (4 lignes, dividers border-b) — inchange.
            Desktop (lg:) : grille 2x2, divider vertical entre colonnes
            (border-r sur les cellules paires) + horizontal entre les 2 rangees
            (border-b sur les cellules du haut, retire sur la cellule bas-gauche). */}
        <div className="rounded-xl overflow-hidden lg:grid lg:grid-cols-2" style={{ border: '0.5px solid rgba(255,255,255,0.08)' }}>
          {axes.map((axe, index) => {
            const isComplete = axe.count >= OBJECTIF_PAR_AXE
            const dots = Array.from({ length: OBJECTIF_PAR_AXE }, (_, i) => i < axe.count)
            const pastilleBg: Record<string, string> = {
              axe1: '#EEF2FF',
              axe2: '#F0FDFA',
              axe3: '#FFF7ED',
              axe4: '#FDF2F8',
            }
            return (
              <div
                key={axe.id}
                className={`px-3 py-2.5 ${
                  index < axes.length - 1 ? 'border-b' : ''
                } ${index % 2 === 0 ? 'lg:border-r' : ''} ${index === 2 ? 'lg:border-b-0' : ''}`}
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}
              >
                <div className="flex items-center gap-3">
                  {/* Pastille */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-base"
                    style={{ background: pastilleBg[axe.id] }}
                  >
                    {axe.icon}
                  </div>

                  {/* Label */}
                  <span className="flex-1 text-sm font-medium text-white">
                    {axe.label}
                  </span>

                  {/* Dots progression */}
                  <div className="flex items-center gap-1.5">
                    {dots.map((filled, i) => (
                      <div
                        key={i}
                        className="w-2.5 h-2.5 rounded-full transition-all"
                        style={filled
                          ? { background: axe.color }
                          : { border: `2px solid ${axe.color}`, opacity: 0.3 }
                        }
                      />
                    ))}
                  </div>

                  {/* Compteur */}
                  <span
                    className="text-xs font-bold min-w-[32px] text-right"
                    style={{ color: isComplete ? '#16A34A' : axe.color }}
                  >
                    {isComplete ? `${axe.count}/2 ✓` : `${axe.count}/2`}
                  </span>
                </div>

                {/* Sous-ligne auto-évaluation annuelle — axe 4 uniquement.
                    Une pastille par année de la période : pleine = réalisée,
                    contour vide = année écoulée non réalisée, grisée = à venir. */}
                {axe.id === 'axe4' && (
                  <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="mb-1.5 text-[11px] font-medium text-white/55">
                      Auto-évaluation santé · une par an
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {anneesPeriode.map(year => {
                        const done = autoevalSet.has(year)
                        const future = year > anneeCourante
                        const label = done
                          ? `${year} ✓ — réalisée`
                          : future
                            ? `${year} — à venir`
                            : `${year} — non réalisée`
                        return (
                          <div key={year} className="flex flex-col items-center gap-0.5" title={label}>
                            <div
                              className="w-3 h-3 rounded-full"
                              style={
                                done
                                  ? { background: axe.color }
                                  : future
                                    ? { background: 'rgba(255,255,255,0.06)' }
                                    : { background: 'transparent', border: `1.5px solid ${axe.color}` }
                              }
                            />
                            <span className="text-[8px] text-white/30 tabular-nums">{`’${String(year).slice(2)}`}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Total */}
        <div className="flex justify-between items-center pt-1">
          <span className="text-xs text-white/55">Total validees</span>
          <span className="text-sm font-bold text-white">
            {totalActions} / {totalObjectif} actions min.
          </span>
        </div>

        {/* Alerte si en retard */}
        {tempsRestant.pourcentageEcoule > 50 && totalActions < totalObjectif / 2 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-700">
              ⚠️ <strong>Attention :</strong> Plus de la moitie de la periode est ecoulee.
              Pensez a valider vos actions restantes.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
