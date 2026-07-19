# PérioBilan — code source

Application React (TypeScript + Vite + Tailwind) du module Bilan parodontal.
Le fichier `periobilan.html` livré dans les conversations est la version **compilée** de ce code : un seul fichier autonome. Ce dossier contient les **sources lisibles**.

## Où se trouve quoi (les fichiers importants)

| Ce que tu cherches | Fichier |
|---|---|
| **Saisie du charting parodontal** (grille de sondage, parcours de saisie, raccourcis clavier S/P/M/F, site actif) | `src/components/Charting.tsx` |
| **Calcul des indices** (PP moy/max, %BOP, PA, cumul poches, scores de risque, PRP, classification stade/grade) | `src/lib/perio/calc.ts` |
| **Mise en page du PDF imprimé** (structure de la feuille A4) | `src/components/PrintView.tsx` + les styles `@media print` dans `src/index.css` |
| Ordre de parcours du curseur (serpentin / dent par dent / vertical) | `src/lib/perio/path.ts` |
| Modèle de données (dent, site, bilan, patient) | `src/lib/perio/types.ts` |
| Facteurs de risque + radar + PRP | `src/components/RiskPanel.tsx` |
| Synthèse (indices affichés, diagnostic, cascade) | `src/components/Synthesis.tsx` |
| Anamnèse + identité patient | `src/components/Anamnesis.tsx` |
| Assemblage général, onglets, bandeau d'avertissement, export PDF | `src/App.tsx` |
| Cas d'exemple pré-rempli | `src/lib/perio/demo.ts` |
| Comparaison multi-bilans (désactivée dans l'app actuelle, code conservé) | `src/components/Evolution.tsx` |
| Tests du moteur de calcul (vérifie les formules) | `test-calc.ts` |

## Le cœur métier tient dans un dossier pur : `src/lib/perio/`

`types.ts`, `calc.ts`, `path.ts` ne dépendent d'aucune bibliothèque d'interface : c'est la logique réutilisable telle quelle pour une future intégration Certily.

## Comment le faire tourner en local (pour un développeur)

```bash
npm install
npm run dev        # ouvre l'app en développement
npm run build      # build classique
npx tsx test-calc.ts   # lance les tests du moteur de calcul
```

Pour régénérer le fichier HTML autonome unique : le script de bundling utilisé est
`web-artifacts-builder/scripts/bundle-artifact.sh` (Parcel + inlining).

## Notes

- Aucun stockage (localStorage/cookies) ni appel réseau : l'app fonctionne hors connexion, les données restent dans la page.
- Classification parodontale = référentiel international 2018 (EFP/AAP).
- Le dossier `src/components/ui/` (shadcn) est fourni par le gabarit de départ mais **n'est pas utilisé** par le module ; tu peux l'ignorer.
