-- Nom du fichier : 20260716c_journal_formation_notif_sent.sql
-- Date de création : 2026-07-16
-- Description : Tables d'idempotence (broadcast, 1 notif par item) pour les
--               deux nouveaux senders push :
--                 - weekly_journal_notifications_sent  (journal hebdo en ligne)
--                 - new_formation_notifications_sent   (nouvelle formation en ligne)
--               + SEED anti-blast rétroactif : on marque comme « déjà notifiés »
--               tous les items DÉJÀ en ligne au moment du déploiement, pour ne
--               notifier que ce qui passe en ligne APRÈS.
-- Rollback : supabase/migrations/20260716c_journal_formation_notif_sent_down.sql
--
-- Pattern repris de live_session_reminders_sent (20260515) : tables techniques
-- service_role uniquement, RLS off + REVOKE ALL.

-- ============================================================================
-- 1. weekly_journal_notifications_sent
-- ============================================================================

CREATE TABLE IF NOT EXISTS weekly_journal_notifications_sent (
  journal_id   uuid        PRIMARY KEY REFERENCES news_episodes(id) ON DELETE CASCADE,
  notified_at  timestamptz DEFAULT now()
);

ALTER TABLE weekly_journal_notifications_sent DISABLE ROW LEVEL SECURITY;
REVOKE ALL ON weekly_journal_notifications_sent FROM PUBLIC;
REVOKE ALL ON weekly_journal_notifications_sent FROM anon;
REVOKE ALL ON weekly_journal_notifications_sent FROM authenticated;

-- SEED anti-blast : journaux déjà en ligne (prédicat identique à
-- /api/news/journal/current : type='journal' + status='published' + audio_url présent).
INSERT INTO weekly_journal_notifications_sent (journal_id)
SELECT id
  FROM news_episodes
 WHERE type = 'journal'
   AND status = 'published'
   AND audio_url IS NOT NULL
ON CONFLICT (journal_id) DO NOTHING;

-- ============================================================================
-- 2. new_formation_notifications_sent
-- ============================================================================

CREATE TABLE IF NOT EXISTS new_formation_notifications_sent (
  formation_id  uuid        PRIMARY KEY REFERENCES formations(id) ON DELETE CASCADE,
  notified_at   timestamptz DEFAULT now()
);

ALTER TABLE new_formation_notifications_sent DISABLE ROW LEVEL SECURITY;
REVOKE ALL ON new_formation_notifications_sent FROM PUBLIC;
REVOKE ALL ON new_formation_notifications_sent FROM anon;
REVOKE ALL ON new_formation_notifications_sent FROM authenticated;

-- SEED anti-blast : formations déjà en ligne du catalogue public
-- (is_published = true + owner_org_id IS NULL). Les contenus de tenants
-- (owner_org_id NOT NULL) ne sont pas concernés par cette notification.
INSERT INTO new_formation_notifications_sent (formation_id)
SELECT id
  FROM formations
 WHERE is_published = true
   AND owner_org_id IS NULL
ON CONFLICT (formation_id) DO NOTHING;

-- ============================================================================
-- Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT count(*) FROM weekly_journal_notifications_sent;  -- = nb journaux publiés
-- SELECT count(*) FROM new_formation_notifications_sent;   -- = nb formations publiques publiées
