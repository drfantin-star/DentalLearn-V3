-- ============================================
-- Allow image uploads in the formations bucket
-- Adds image/png, image/jpeg, image/jpg to allowed MIME types
-- ============================================

UPDATE storage.buckets
SET allowed_mime_types = (
  SELECT array_agg(DISTINCT mime)
  FROM unnest(
    array_cat(
      COALESCE(allowed_mime_types, ARRAY[]::text[]),
      ARRAY['image/png', 'image/jpeg', 'image/jpg']
    )
  ) AS mime
)
WHERE name = 'formations';
