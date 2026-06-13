-- Rollback : fiche bibliographie PDF par formation
-- NB : on ne retire pas 'application/pdf' du bucket `formations` car ce type
-- pré-existait à cette migration (utilisé par d'autres médias).

ALTER TABLE formations DROP COLUMN IF EXISTS biblio_pdf_url;
