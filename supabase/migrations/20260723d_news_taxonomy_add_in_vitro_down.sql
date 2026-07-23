-- Rollback de 20260723d_news_taxonomy_add_in_vitro.sql.
-- DELETE conditionne (option B) : on ne supprime la ligne de taxonomie QUE si
-- aucune synthese ne porte encore le tag 'in-vitro'. Sinon la suppression
-- laisserait ces tags hors de la liste active lue par validateTags, les rendant
-- silencieusement invalides. La garde NOT EXISTS fait du rollback un no-op tant
-- que le slug est utilise (la ligne reste active=true et valide).
DELETE FROM news_taxonomy
WHERE type = 'niveau_preuve'
  AND slug = 'in-vitro'
  AND NOT EXISTS (
    SELECT 1 FROM news_syntheses WHERE niveau_preuve = 'in-vitro'
  );
