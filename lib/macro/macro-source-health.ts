import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type MacroSourceHealth = {
  latestAttemptAt: string | null;
  latestAttemptStatus: string | null;
  latestAttemptTransportStatus: number | null;
  latestAttemptErrorCode: string | null;
  latestCompleteAt: string | null;
  latestCompleteSnapshotId: string | null;
  staleFallbackActive: boolean;
};

export async function getMacroSourceHealth(): Promise<MacroSourceHealth> {
  try {
    const client = createSupabaseAdminClient();
    const [{ data: latestAttempt }, { data: latestComplete }] = await Promise.all([
      client
        .from("macro_source_snapshots")
        .select("id,capture_completed_at,status,transport_status,transport_error_code")
        .eq("source_key", "macro_indicators")
        .order("capture_completed_at", { ascending: false })
        .limit(1)
        .maybeSingle<{
          id: string;
          capture_completed_at: string | null;
          status: string;
          transport_status: number | null;
          transport_error_code: string | null;
        }>(),
      client
        .from("macro_source_snapshots")
        .select("id,capture_completed_at")
        .eq("source_key", "macro_indicators")
        .eq("status", "complete")
        .order("capture_completed_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string; capture_completed_at: string | null }>(),
    ]);

    const latestAttemptAt = latestAttempt?.capture_completed_at ?? null;
    const latestCompleteAt = latestComplete?.capture_completed_at ?? null;
    return {
      latestAttemptAt,
      latestAttemptStatus: latestAttempt?.status ?? null,
      latestAttemptTransportStatus: latestAttempt?.transport_status ?? null,
      latestAttemptErrorCode: latestAttempt?.transport_error_code ?? null,
      latestCompleteAt,
      latestCompleteSnapshotId: latestComplete?.id ?? null,
      staleFallbackActive: Boolean(
        latestAttemptAt
        && latestCompleteAt
        && latestAttemptAt !== latestCompleteAt
        && latestAttempt?.status !== "complete"
      ),
    };
  } catch {
    return {
      latestAttemptAt: null,
      latestAttemptStatus: null,
      latestAttemptTransportStatus: null,
      latestAttemptErrorCode: null,
      latestCompleteAt: null,
      latestCompleteSnapshotId: null,
      staleFallbackActive: false,
    };
  }
}
