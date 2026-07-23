-- Rollback de 20260723i_retag_in_vitro_syntheses.sql.
-- Restaure niveau_preuve depuis le snapshot pour les 65 lignes retaguees,
-- puis supprime la table de snapshot (propre a la migration up ci-dessus).

UPDATE news_syntheses ns
SET niveau_preuve = snap.niveau_preuve
FROM news_syntheses_retag_in_vitro_20260723_snapshot snap
WHERE ns.id = snap.id;

DROP TABLE IF EXISTS news_syntheses_retag_in_vitro_20260723_snapshot;
