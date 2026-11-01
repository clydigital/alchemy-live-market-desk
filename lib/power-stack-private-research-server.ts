import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Single-owner private legacy research archive. Never expose the whole
 * portfolio snapshot to public request handlers or browser bundles.
 * Additional owner records fail closed until there is an explicit owner key.
 */
export async function getPrivatePowerStackArchiveField(
  field: "developingThemes" | "fundamentalsSnapshot",
): Promise<unknown | null> {
  try {
    const admin=createSupabaseAdminClient();
    const { data, error } = await admin.from("power_stack_owner_snapshots")
      .select("snapshot").order("snapshot_as_of",{ascending:false}).limit(2);
    if(error || !Array.isArray(data) || data.length !== 1)return null;
    const snapshot:unknown=data[0]?.snapshot;
    if(!snapshot || typeof snapshot!=="object" || Array.isArray(snapshot))return null;
    const record=snapshot as Record<string,unknown>;
    return record[field] ?? null;
  } catch {
    return null;
  }
}
