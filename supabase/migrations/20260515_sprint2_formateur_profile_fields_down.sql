ALTER TABLE formateur_profiles
  DROP COLUMN IF EXISTS annees_experience,
  DROP COLUMN IF EXISTS ville,
  DROP COLUMN IF EXISTS cabinet_nom,
  DROP COLUMN IF EXISTS instagram_url;
