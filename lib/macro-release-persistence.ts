import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function persistMacroReleaseLifecycle(now = new Date()) {
  try {
    const client = createSupabaseAdminClient();
    const { data, error } = await client.rpc("refresh_macro_release_lifecycle", {
      p_now: now.toISOString(),
      p_ingestion_grace: "04:00:00",
    });
    if (error) {
      return { available: false as const, reason: error.message, summary: null };
    }
    const summary = Array.isArray(data) ? data[0] || null : data;
    return { available: true as const, reason: null, summary };
  } catch (error) {
    return {
      available: false as const,
      reason: error instanceof Error ? error.message : String(error),
      summary: null,
    };
  }
}
