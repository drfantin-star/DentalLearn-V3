// Shared Supabase client factory for Edge Functions (service role).
//
// Edge Functions run server-side only : il est permis d'utiliser la
// service_role key, qui bypasse les RLS (spec §5, news_* policies service-role-only).
// La clé est lue depuis les secrets d'exécution Supabase (jamais en dur).
//
// Usage :
//   import { getServiceClient } from "../_shared/supabase.ts";
//   const supabase = getServiceClient();

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export function getServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url) throw new Error("SUPABASE_URL env var is missing");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY env var is missing");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
