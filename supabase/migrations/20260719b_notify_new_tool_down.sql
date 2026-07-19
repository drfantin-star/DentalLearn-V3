-- Rollback : 20260719b_notify_new_tool
DROP TRIGGER IF EXISTS tools_notify_published ON public.tools;
DROP FUNCTION IF EXISTS public.notify_tools_published();
ALTER TABLE public.user_notification_preferences DROP COLUMN IF EXISTS new_tools;
