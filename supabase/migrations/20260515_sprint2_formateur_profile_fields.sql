-- Sprint 2 T6 — Ajoute les colonnes de profil manquantes dans formateur_profiles.
-- Les RLS existantes (SELECT/UPDATE) couvrent déjà les règles T6 — aucune policy nouvelle.
ALTER TABLE formateur_profiles
  ADD COLUMN IF NOT EXISTS annees_experience int,
  ADD COLUMN IF NOT EXISTS ville varchar(120),
  ADD COLUMN IF NOT EXISTS cabinet_nom varchar(200),
  ADD COLUMN IF NOT EXISTS instagram_url text;
