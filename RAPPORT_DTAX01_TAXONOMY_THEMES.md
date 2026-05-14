# RAPPORT D-TAX-01 — Extension taxonomy themes + cleanup rétroactif

**Date** : 14/05/2026  
**Statut** : ✅ Livré  
**Migrations** : `20260514a_dtax01_taxonomy_themes_extension` + `20260514b_dtax01_cleanup_ids_faux_positifs`

## Résumé
- **Chantier A** : +19 slugs `theme` dans `news_taxonomy` (total 27 slugs theme actifs)
- **Chantier B** : `array_remove('ids')` sur 140 synthèses actives faux-positives

## Baseline avant migration
- 8 slugs theme actifs
- 140/204 synthèses actives taggées `'ids'` (68,6%)

## État après migration
- 27 slugs theme actifs
- 0 synthèse active avec `'ids'` dans themes

## Dettes résiduelles
- **Phase 2 re-tagging** : ~127 synthèses ont désormais `themes=[]`. Re-tagging Sonnet supervisé à planifier post-T13.
- **Vraies IDS** : ~5-10 synthèses dent-resto légitimement IDS se retrouvent avec `themes=[]`. À re-tagger manuellement via T12 editor.
- **Prompt Sonnet** : pipeline ingestion T7-bis non mis à jour (hors scope D-TAX-01). Sonnet bénéficiera de la nouvelle taxonomy au prochain enrichissement du prompt (T13+).
