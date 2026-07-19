-- Migration : 20260719b_notify_new_tool
-- 1. Colonne new_tools dans user_notification_preferences (défaut true)
-- 2. Trigger sur tools : is_published false → true → cloche + push
-- Rollback : supabase/migrations/20260719b_notify_new_tool_down.sql

-- 1. Préférence utilisateur
ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS new_tools boolean NOT NULL DEFAULT true;

-- 2. Fonction trigger
CREATE OR REPLACE FUNCTION public.notify_tools_published()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_slug        text := NEW.slug::text;
  v_title       text := NEW.title::text;
  v_supa_url    text := current_setting('app.supabase_url', true);
  v_service_key text := current_setting('app.service_role_key', true);
BEGIN
  -- Uniquement sur la transition is_published false → true
  IF NOT (OLD.is_published = false AND NEW.is_published = true) THEN
    RETURN NEW;
  END IF;

  -- Cloche (source canonique) : une ligne par utilisateur actif
  -- Dédup : exclure ceux qui ont déjà reçu la notif pour ce slug
  INSERT INTO public.notifications
    (user_id, type, title, message, status, sent_at, metadata)
  SELECT
    u.id,
    'push'::public.notification_type,
    'Nouvel outil dans ta boîte',
    v_title || ' est prêt à l''emploi.',
    'pending'::public.notification_status,
    now(),
    jsonb_build_object('kind', 'new_tool', 'slug', v_slug, 'href', '/outils')
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = u.id
      AND n.metadata->>'kind' = 'new_tool'
      AND n.metadata->>'slug' = v_slug
  );

  -- Push : appel Edge Function (async via pg_net)
  IF v_supa_url IS NOT NULL AND v_service_key IS NOT NULL THEN
    PERFORM net.http_post(
      url     := v_supa_url || '/functions/v1/notify_new_tool',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_service_key,
        'Content-Type',  'application/json'
      ),
      body    := jsonb_build_object('slug', v_slug, 'title', v_title)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tools_notify_published
  AFTER UPDATE OF is_published ON public.tools
  FOR EACH ROW EXECUTE FUNCTION public.notify_tools_published();
