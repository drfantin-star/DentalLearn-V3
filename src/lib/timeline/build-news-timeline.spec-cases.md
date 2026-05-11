# `buildNewsTimeline()` — 5 cas de test fixtures (T8-B)

Format à la T4/T5 : fixtures textuelles décrivant **input** et **output attendu**.
Pas de framework de test runtime — vérification manuelle au cadrage et lors
des évolutions. Run au besoin via un REPL ts-node ou un test ad hoc.

## Convention

- `taxonomyLabels` = `{ 'paro': 'Parodontologie', 'meta-analyse': 'Méta-analyse', ... }`
  (résolu en amont via `resolveTaxonomyLabels()`).
- `episode.duration_s` exprimé en secondes (= durée totale du MP3).
- Chaque synthèse → 1 chapter, partition uniforme de la durée d'épisode.
- Garantie Zod : `TimelineSchema.safeParse(result).success === true` (sinon warning console, fonction retourne quand même la timeline).

---

## Cas 1 — Journal complet 3 synthèses, tous champs remplis

**Input (proche du journal W18 du pré-flight #4, 3 synthèses)** :

```ts
{
  episode: {
    id: 'journal-w18',
    type: 'journal',
    audio_url: 'https://.../journal/w18.mp3',
    duration_s: 720, // 12 min
  },
  syntheses: [
    {
      id: 's1', position: 1,
      display_title: 'Greffe gingivale : taux de survie à 5 ans',
      summary_fr: '…',
      specialite: 'paro',
      themes: ['greffe-gencive'],
      key_figures: ['92 % de survie à 5 ans', 'OR=2.4', 'n=240'],
      method: 'Méta-analyse de 12 RCT…',
      evidence_level: 'élevé',
      niveau_preuve: 'meta-analyse',
      clinical_impact: 'Renforce l\'indication de la greffe gingivale chez le patient à risque parodontal.',
      caveats: 'Hétérogénéité de la méthode chirurgicale entre études.',
    },
    {
      id: 's2', position: 2,
      display_title: 'IDS : impact sur la longévité des restaurations indirectes',
      summary_fr: '…',
      specialite: 'dent-resto',
      themes: ['ids', 'endocrown'],
      key_figures: ['+18 mois de survie en moyenne'],
      method: 'Cohorte rétrospective 5 ans',
      evidence_level: 'modéré',
      niveau_preuve: 'cohorte',
      clinical_impact: 'Justifie l\'IDS en pratique courante avant prise d\'empreinte définitive.',
      caveats: 'Étude unicentrique.',
    },
    {
      id: 's3', position: 3,
      display_title: 'Aligneurs vs multi-attache : 24 mois',
      summary_fr: '…',
      specialite: 'odf',
      themes: ['aligneurs'],
      key_figures: ['Δ PAR-score = 0.3 (NS)'],
      method: 'RCT multicentrique',
      evidence_level: 'élevé',
      niveau_preuve: 'rct',
      clinical_impact: 'Aligneurs non inférieurs sur cas de complexité légère à modérée.',
      caveats: 'Exclusion des cas chirurgicaux et des Class III sévères.',
    },
  ],
  taxonomyLabels: {
    paro: 'Parodontologie',
    'greffe-gencive': 'Greffe gingivale',
    'meta-analyse': 'Méta-analyse',
    'dent-resto': 'Dentisterie restauratrice et esthétique',
    ids: 'IDS (Immediate Dentin Sealing)',
    endocrown: 'Endocouronne',
    cohorte: 'Étude de cohorte',
    odf: 'Orthodontie dento-faciale',
    aligneurs: 'Aligneurs transparents',
    rct: 'Essai contrôlé randomisé',
  },
}
```

**Output attendu** :

- `timeline.chapters.length === 3`
- Chaque chapter : durée ≈ 240s, bornes `[0, 240]`, `[240, 480]`, `[480, 720]`.
- `timeline.scenes.length === 3 × 7 = 21` (chaque synthèse a 7 scènes : grid spécialités + figures chiffres + niveau_preuve + méthode + impact + caveats + recap).
- Première scène = `{ kind: 'grid', columns: 2, cards: [Parodontologie (highlight), Greffe gingivale] }`.
- 7e scène (recap S1) = `{ kind: 'recap', title: 'En résumé — Greffe gingivale : taux de survie à 5 ans', figures: [3 items], impact: '…', caveats: '…' }`.
- `timeline.generator === 'auto_news_deterministic'`.
- `timeline.source_type === 'news_synthesis'`.
- Validation Zod passe.

---

## Cas 2 — Synthèse minimale (uniquement specialite + summary_fr)

**Input** :

```ts
{
  episode: { id: 'ep-min', type: 'digest', audio_url: '…', duration_s: 120 },
  syntheses: [{
    id: 's1', position: 1,
    display_title: 'Brève actualité',
    summary_fr: 'Texte de résumé.',
    specialite: 'actu-pro',
    themes: null,
    key_figures: null,
    method: null,
    evidence_level: null,
    niveau_preuve: null,
    clinical_impact: null,
    caveats: null,
  }],
  taxonomyLabels: { 'actu-pro': 'Actualité professionnelle' },
}
```

**Output attendu** :

- `timeline.chapters.length === 1`, durée [0, 120].
- `timeline.scenes.length === 2` : 1 grid spécialités (1 card highlight) + 1 recap (title uniquement, ni figures ni impact ni caveats).
- Validation Zod passe.

---

## Cas 3 — Synthèse riche en chiffres (3 key_figures + emphasis premier)

**Input** :

```ts
{
  episode: { id: 'ep-stats', type: 'insight', audio_url: '…', duration_s: 300 },
  syntheses: [{
    id: 's1', position: 1,
    display_title: 'Apnée et bruxisme : prévalence croisée',
    summary_fr: 'Méta-analyse récente.',
    specialite: 'occluso',
    themes: ['apnee', 'bruxisme'],
    key_figures: ['43 % co-prévalence', 'OR=3.2 (IC95% 2.1–4.8)', 'p<0.001'],
    method: 'Méta-analyse 18 études',
    evidence_level: null,
    niveau_preuve: 'meta-analyse',
    clinical_impact: 'Recommande screening apnée chez tout patient bruxomane diagnostiqué.',
    caveats: null,
  }],
  taxonomyLabels: {
    occluso: 'Occlusodontie',
    apnee: 'Apnée obstructive du sommeil',
    bruxisme: 'Bruxisme',
    'meta-analyse': 'Méta-analyse',
  },
}
```

**Output attendu** :

- 1 chapter [0, 300].
- 6 scènes : grid spécialités (3 cols : Occluso highlight + Apnée + Bruxisme) + figures (`value='43 %'`, `value='OR=3.2'`, `value='p<0.001'`, premier emphasis) + niveau_preuve (`value='Méta-analyse'` emphasis) + méthode + impact (highlight) + recap (3 figures + impact, pas de caveats).
- Vérification clamp cols : 3 topics → columns=3. ✅

---

## Cas 4 — Synthèse 4+ thèmes (test clampCols)

**Input** :

```ts
{
  episode: { id: 'ep-themes', type: 'digest', audio_url: '…', duration_s: 180 },
  syntheses: [{
    id: 's1', position: 1,
    display_title: 'Approches contemporaines en endodontie',
    summary_fr: '…',
    specialite: 'endo',
    themes: ['retraitement-endo', 'endocrown', 'ids', 'peri-implantite'], // 4 thèmes + specialite = 5 → clamp à 4
    key_figures: ['Δ succès = +12 %'],
    method: 'Revue systématique',
    evidence_level: null,
    niveau_preuve: 'revue-systematique',
    clinical_impact: 'Mise à jour des recommandations endodontiques 2026.',
    caveats: 'Recommandations préliminaires.',
  }],
  taxonomyLabels: {
    endo: 'Endodontie',
    'retraitement-endo': 'Retraitement endodontique',
    endocrown: 'Endocouronne',
    ids: 'IDS (Immediate Dentin Sealing)',
    'peri-implantite': 'Péri-implantite',
    'revue-systematique': 'Revue systématique',
  },
}
```

**Output attendu** :

- 1 chapter [0, 180].
- 7 scènes : grid spécialités avec `columns=4` (clamp depuis 5 topics) + 5 cards visibles tout de même (Grid component gère le flex-wrap au-delà des 4 colonnes initiales) + reste habituel.
- Première card = `Endodontie` avec variant `highlight`.

---

## Cas 5 — Synthèse "extrême" (display_title + caveats très longs)

**Input** :

```ts
{
  episode: { id: 'ep-long', type: 'digest', audio_url: '…', duration_s: 240 },
  syntheses: [{
    id: 's1', position: 1,
    display_title: 'Étude prospective sur l\'impact à long terme des protocoles d\'implantologie immédiate en zone esthétique chez les patients tabagiques',
    // 167 chars — sera tronqué pour le chapter title (80 chars) et pour le recap (80 chars)
    summary_fr: '…',
    specialite: 'implanto',
    themes: null,
    key_figures: ['Survie à 10 ans : 78 % (vs 91 % non-tabagiques)'],
    method: 'Cohorte prospective 10 ans, n=412',
    evidence_level: 'élevé',
    niveau_preuve: 'cohorte',
    clinical_impact: 'Confirme la nécessité d\'un protocole adapté chez le patient tabagique, avec consentement éclairé spécifique.',
    caveats: 'Étude monocentrique limitée à la zone esthétique antérieure ; résultats à confirmer en zone postérieure et sur populations plus diversifiées (variabilité génétique du métabolisme nicotinique non contrôlée dans la cohorte).', // 250+ chars → tronqué à 60 dans la scène caveats, à 160 dans le recap
  }],
  taxonomyLabels: {
    implanto: 'Implantologie',
    cohorte: 'Étude de cohorte',
  },
}
```

**Output attendu** :

- Chapter title tronqué à 80 chars + '…' final.
- Scène caveats : `text` tronqué à 60 chars (+ '…').
- Scène recap : `title` tronqué à 80 chars, `caveats` tronqué à 160 chars (+ '…').
- Validation Zod passe (toutes les limites max() respectées par construction).
- Aucun overflow visuel attendu côté Grid/Recap component.

---

## Garde-fous validés par construction

- ✅ `TimelineSchema.safeParse()` toujours `success: true` sur les 5 cas (limites max() respectées par `truncate()`).
- ✅ `start_sec < end_sec` strict pour toutes les scènes (cursor monotone + sceneIdx === last → end_sec = chapter_end).
- ✅ `columns ∈ {1,2,3,4}` (clampCols).
- ✅ `figures` ≤ 3 dans recap (slice(0,3)).
- ✅ Pas de scène vide : minimum 1 scène par synthèse (grid 1 card si aucun champ).
- ✅ `chapters.length === syntheses.length` toujours.
