-- Nom du fichier : 20260503_sprint1_org_curated_formations.sql
-- Date de création : 2026-05-03
-- Ticket : Sprint 1 / T6 — claude/tenant-admin-space-Uuon5
-- Description : Table de liaison org_curated_formations pour épingler des formations Dentalschool dans le catalogue d'une organisation hr_entity ou training_org. RLS deny pour authenticated, accès via service_role uniquement (API /api/tenant/curation).
-- Rollback : supabase/migrations/20260503_sprint1_org_curated_formations_down.sql

CREATE TABLE org_curated_formations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  formation_id uuid NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, formation_id)
);

CREATE INDEX org_curated_formations_org_id_idx ON org_curated_formations (org_id);
CREATE INDEX org_curated_formations_org_order_idx ON org_curated_formations (org_id, display_order);

-- RLS : aucune policy pour authenticated → toutes les opérations passent par
-- l'API serveur avec createAdminClient() (service_role bypass RLS).
ALTER TABLE org_curated_formations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE org_curated_formations IS
  'Liaison org → formations Dentalschool épinglées dans le catalogue tenant. Géré exclusivement via /api/tenant/curation (service_role).';
