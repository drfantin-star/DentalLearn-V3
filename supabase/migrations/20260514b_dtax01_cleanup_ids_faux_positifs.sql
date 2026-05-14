-- D-TAX-01 Chantier B : Cleanup rétroactif des 140 faux-positifs 'ids'
-- Retire le slug 'ids' des synthèses actives où il était tagué par défaut
-- (fallback Sonnet quand aucun slug du catalogue ne matchait le sujet réel)
--
-- IMPORTANT : ne supprime PAS les lignes où 'ids' est le seul slug intentionnel
-- (vraies IDS cliniques ~5-10 synthèses) — celles-ci se retrouveront avec themes=[]
-- et seront re-taguées manuellement via T12 editor par Dr Fantin.
--
-- Le slug 'ids' reste ACTIF dans news_taxonomy (non désactivé).
-- Trigger trg_sync_news_synthesis_published_at non déclenché (UPDATE OF raw_id uniquement).

UPDATE news_syntheses
SET
  themes = array_remove(themes, 'ids'),
  last_edited_at = NOW(),
  last_edited_by = 'af506ec2-a281-4485-a504-b0633c8d2362'  -- UUID admin Dr Fantin
WHERE
  status = 'active'
  AND 'ids' = ANY(themes);
