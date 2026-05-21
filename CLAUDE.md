# CLAUDE.md — DentalLearn V3

Repository conventions et contraintes d'infrastructure pour les agents IA
(Claude Code, etc.) travaillant sur ce projet.

## Vercel Pro dependencies

Les routes suivantes nécessitent un plan Vercel **Pro ou supérieur** pour
fonctionner en production. Sur le plan **Hobby**, les routes Serverless
Node.js sont plafonnées à **10 s** d'exécution, ce qui coupe systématiquement
les appels LLM longs avant retour.

| Route | Runtime | `maxDuration` | Raison |
|---|---|---|---|
| `POST /api/admin/timeline/extract-scenes` | nodejs | 60 s | Appel Sonnet 4.6 d'extraction structurelle (~30-45 s par run) |

**Historique de la décision** (T5-bis-fix3, mai 2026) :
- Bascule vers `runtime = 'edge'` (fix2) : le build passait clean mais le
  worker edge crashait au runtime avec une réponse texte brute
  `"An error occurred"` (probablement un import transitif edge-incompatible
  dans `@supabase/ssr` ou le SDK Anthropic, jamais diagnostiqué à la racine).
- Bascule vers Supabase Edge Function (fix3 plan) : évaluée et **rejetée**.
  Coût de portage TS → Deno estimé à ~1660 lignes (schéma Zod
  `discriminatedUnion` + `.refine()`, `buildTimelineFromRaw`, prompt qui
  vient d'être itéré en T5-bis, helpers word-index/parse-recovery). Drift
  inévitable sur les itérations prompt futures, sans tests partagés.
- Décision : rester sur `nodejs` + `maxDuration = 60` et formaliser la
  dépendance Vercel Pro. Toute future route lente (T6, T8) suivra le même
  pattern.

## Constantes globales / hooks à NE PAS modifier

- `src/context/AudioContext.tsx` — contexte audio global, modifié uniquement
  via tickets dédiés
- `src/components/audio/AudioPlayer.tsx` — UI player, idem
- `course_watch_logs` (table) — préservé pour DPC
- `useSubmitSequenceResult` — seul write path autorisé sur `user_points`

## Source de vérité — progression des séquences

Depuis le commit `19a589c` (PR auto-inscription user, mai 2026), il existe
**une seule** source de vérité pour la complétion pédagogique.

- **`user_sequences`** = source unique **pédagogique** (progression, compteur
  "X/N", pastilles ✓, points). Stateful : 1 ligne par `(user_id, sequence_id)`,
  contrainte `UNIQUE(user_id, sequence_id)`. Toute UI de progression DOIT lire
  cette table (cf. `useUserFormationProgress` dans `src/lib/supabase/hooks.ts`).
- **`course_watch_logs`** = audit **DPC immuable**. Plusieurs logs par séquence
  possibles (tracking anti-skip). Ne JAMAIS l'utiliser pour l'UI pédagogique.
- Les RPC `is_sequence_completed()` et `get_user_completed_sequences()` ont été
  **retirés** en `19a589c` (ils s'appuyaient sur `course_watch_logs` et créaient
  une double source de vérité). Ne pas les recréer.
- **Unique pont autorisé** `course_watch_logs` → `user_sequences` :
  `backfillIntroCompletions` dans `src/components/formation/EnrollmentCTA.tsx`,
  qui rétro-marque à l'inscription les **intros audio-only** déjà écoutées
  (exclut toute intro possédant un quiz).

## Couleurs interdites dans les nouveaux fichiers

`#2D1B96`, `#231575`, `#00D1C1` — anciennes constantes du design system,
remplacées par les tokens Tailwind du brand kit actuel.
