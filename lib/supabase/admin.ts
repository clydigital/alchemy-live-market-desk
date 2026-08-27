import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "./config.ts";

export function createSupabaseAdminClient() {
  const { url } = getSupabasePublicConfig();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for server-only Supabase operations.");
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
