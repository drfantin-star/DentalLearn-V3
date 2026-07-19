-- Rollback : 20260719a_tools
DROP TRIGGER IF EXISTS tools_updated_at ON public.tools;
DROP FUNCTION IF EXISTS public.tools_set_updated_at();
DROP TABLE IF EXISTS public.tools;
