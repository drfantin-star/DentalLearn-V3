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

## ~~`parking/sm2-spaced-repetition`~~ — RÉSOLU (mergé sur `main`)

> **Mise à jour 2026-06-14 :** cette entrée n'est plus valide. SM-2 a
> finalement été **mergé sur `main`** (PR #352/#353). Il n'existe plus de
> branche SM-2 « parquée en attente ». Conservé ici pour historique.

| Champ | Valeur |
|---|---|
| Statut | **Mergé sur `main`** via PR #352/#353 |
| Migration en prod | `supabase/migrations/20260516d_sm2_review.sql` (préfixe `d`, plus de collision avec `20260516c_t6_audio_batch.sql`) |

### Ce qui est en production aujourd'hui

SM-2 vit en deux mécanismes distincts :

- **Mécanisme A — remédiation fin de bloc (CONSERVÉ).** Re-pose en fin de
  bloc les questions ratées du même bloc. S'appuie sur la table
  `user_question_review` et les RPC `update_sm2_state`,
  `record_question_acquisition`, `get_bloc_failed_questions`,
  `get_bloc_acquisition_status`.
- **Mécanisme B — révision inter-sessions (RETIRÉ le 2026-06-14, PR #378).**
  Proposait, au sein du `SequencePlayer` (phase `'review'`), des questions à
  réviser d'autres séquences via la route `src/app/api/user/review-stats/`
  et la RPC `get_sm2_review_questions`. Surface retirée car non retenue
  produit. La route a été supprimée ; la RPC orpheline
  `get_sm2_review_questions(uuid,uuid,integer)` est droppée par la migration
  `supabase/migrations/20260614a_drop_sm2_review_questions.sql`.

### ⚠️ Ne JAMAIS droper (mécanisme A en dépend)

Table `user_question_review` + RPC `update_sm2_state`,
`record_question_acquisition`, `get_bloc_failed_questions`,
`get_bloc_acquisition_status`. Seule `get_sm2_review_questions` (propre au
mécanisme B retiré) était orpheline et a été supprimée.
