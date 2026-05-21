# Branches en parking

Ce fichier liste les branches `parking/*` du repo : du travail livré par
Claude Code ou par un dev, **non validé produit**, conservé pour reprise
ultérieure. Elles ne doivent pas être mergées en l'état.

## Convention

- Préfixe : `parking/<slug>`
- Pas de PR ouverte
- Statut documenté dans ce fichier
- Suppression interdite sans validation explicite de Julie

---

## `parking/sm2-spaced-repetition`

| Champ | Valeur |
|---|---|
| Date archivage | 2026-05-21 |
| Origine | Branche `claude/dentallearn-development-4I9EV` renommée |
| Statut produit | En attente — discussion "(en attente) catalogue fonctionnalité" |
| Statut technique | Feature complète, livrée prématurément sans demande explicite |

### Contenu

- Algorithme SuperMemo 2 (SM-2) pour répétition espacée des séquences de formation
- Route API : `src/app/api/user/review-stats/route.ts`
- Migration : `supabase/migrations/20260516c_sm2_review.sql` (+ `_down.sql`)
- Modifications : `src/components/formation/SequencePlayer.tsx`

### ⚠️ À traiter avant tout merge futur

**Collision de préfixe de migration.** Le fichier `20260516c_sm2_review.sql`
partage le préfixe `20260516c_` avec `20260516c_t6_audio_batch.sql` déjà
présent dans `main`. Renommer la migration SM-2 avec un préfixe disponible
(ex. `20260521a_sm2_review.sql` ou date du sprint de reprise) avant tout
merge, sinon ordre d'application non déterministe côté Supabase.

### Conditions de reprise

- Validation produit explicite (priorisation dans un sprint dédié)
- Définition fonctionnelle : portée (Daily Quiz uniquement ? Séquences ? Les deux ?), UI feedback (boutons type Anki ?), intégration au système de points existant
- Rebase sur `main` actuel (la branche aura probablement divergé significativement)
- Renommage de la migration SQL (cf. ci-dessus)
- Tests d'intégration avec `useSubmitSequenceResult` (source unique d'écriture sur `user_points`)
