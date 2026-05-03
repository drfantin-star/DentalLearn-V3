-- Nom du fichier : 20260503c_sprint1_organizations_siret.sql
-- Date de création : 2026-05-03
-- Ticket : Sprint 1 / T9 — claude/dentallearn-development-QTk8B
-- Description : Auto-onboarding cabinet au signup. Ajout des colonnes
--               siret / forme_juridique / adresse sur organizations pour
--               persister les infos retournées par l'API recherche-entreprises
--               (gouv.fr) lors de la création d'un cabinet par un titulaire.
-- Rollback : supabase/migrations/20260503c_sprint1_organizations_siret_down.sql

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS siret varchar(14) NULL;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS forme_juridique varchar(50) NULL;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS adresse text NULL;

-- Pas de UNIQUE sur siret en V1 : un titulaire peut techniquement créer 2 fois
-- la même org en cas de retry post-signup. La déduplication est gérée côté
-- API (/api/auth/create-cabinet) via une vérif owner_user_id avant INSERT.

COMMENT ON COLUMN organizations.siret IS
  'Numéro SIRET du cabinet (14 chiffres). Renseigné automatiquement à la création via API recherche-entreprises gouv.fr. NULL pour les orgs créées en back-office sans SIRET (Dentalschool, certains OF tiers).';

COMMENT ON COLUMN organizations.forme_juridique IS
  'Forme juridique légale (EI, SELARL, SELAS, SCP, SCM, SARL, etc.). Source : libellé categorieJuridiqueUniteLegale gouv.fr.';

COMMENT ON COLUMN organizations.adresse IS
  'Adresse du siège social (texte libre, rendu API gouv.fr concaténé : voie + code postal + commune).';
