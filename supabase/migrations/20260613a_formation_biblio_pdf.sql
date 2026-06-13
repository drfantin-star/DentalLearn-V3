-- Fiche bibliographie PDF par formation
-- Ajoute la colonne biblio_pdf_url et garantit que le bucket `formations`
-- accepte le type application/pdf (no-op si déjà présent).

ALTER TABLE formations
  ADD COLUMN IF NOT EXISTS biblio_pdf_url TEXT;

UPDATE storage.buckets
SET allowed_mime_types =
  CASE
    WHEN allowed_mime_types IS NULL THEN NULL
    WHEN 'application/pdf' = ANY(allowed_mime_types) THEN allowed_mime_types
    ELSE array_append(allowed_mime_types, 'application/pdf')
  END
WHERE id = 'formations';
