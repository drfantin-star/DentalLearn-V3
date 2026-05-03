-- Nom du fichier : 20260503c_sprint1_organizations_siret_down.sql
-- Date de création : 2026-05-03
-- Ticket : Sprint 1 / T9 — claude/dentallearn-development-QTk8B
-- Description : Rollback symétrique. Supprime les 3 colonnes ajoutées
--               sur organizations (siret, forme_juridique, adresse).
--               Aucune donnée critique : ces colonnes n'étaient consommées
--               qu'à titre informatif (pas de RLS / contrainte / FK).

ALTER TABLE organizations DROP COLUMN IF EXISTS adresse;
ALTER TABLE organizations DROP COLUMN IF EXISTS forme_juridique;
ALTER TABLE organizations DROP COLUMN IF EXISTS siret;
