import { fetchJinaReader } from "@/lib/acquisition/jina-reader";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MacroCaptureResult } from "./macro-capture";
import {
  DAILY_INVESTMENT_BRIEF_SOURCE,
  MACROMICRO_SOURCE,
  macroContextBlockReason,
  macroContextFingerprint,
  macroContextText,
  type MacroContextSource,
} from "./macro-context-source";

const RAW_CAPTURE_LIMIT = 250_000;

type TransportResult = {
  ok: boolean;
  text: string;
  transport: "direct_http" | "jina_reader";
  status: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  usedAuthentication: boolean;
  authenticationMode: "none" | "bearer";
};

type SourceAttempt = {
  source: MacroContextSource;
  snapshotId: string | null;
  status: "complete" | "partial" | "failed";
  blockReason: string | null;
  transport: TransportResult["transport"];
  note: string;
};

async function directFetch(source: MacroContextSource, fetcher: typeof fetch): Promise<TransportResult> {
  try {
    const response = await fetcher(source.url, {
      headers: {
        accept: "text/html,application/xhtml+xml,text/plain",
        "user-agent": "Alchemy Live Market Desk macro context collector",
      },
      signal: AbortSignal.timeout(12_000),
    });
    const text = await response.text();
    return {
      ok: response.ok,
      text,
      transport: "direct_http",
      status: response.status,
      errorCode: response.ok ? null : `http_${response.status}`,
      errorMessage: response.ok ? null : text.slice(0, 500),
      usedAuthentication: false,
      authenticationMode: "none",
    };
  } catch (error) {
    return {
      ok: false,
      text: "",
      transport: "direct_http",
      status: null,
      errorCode: "direct_fetch_failed",
      errorMessage: error instanceof Error ? error.message : String(error),
      usedAuthentication: false,
      authenticationMode: "none",
    };
  }
}

async function acquireSource(
  source: MacroContextSource,
  options: { apiKey?: string | null; fetcher?: typeof fetch } = {},
): Promise<TransportResult> {
  const direct = await directFetch(source, options.fetcher ?? fetch);
  if (direct.ok && !macroContextBlockReason(source, direct.text)) return direct;

  const apiKey = options.apiKey?.trim();
  if (!apiKey) return direct;
  const jina = await fetchJinaReader({ sourceUrl: source.url, apiKey, timeoutMs: 30_000 });
  if (!jina.ok) {
    return {
      ok: false,
      text: jina.text || direct.text,
      transport: "jina_reader",
      status: jina.status,
      errorCode: jina.errorCode,
      errorMessage: jina.errorMessage,
      usedAuthentication: jina.usedAuthentication,
      authenticationMode: jina.authenticationMode,
    };
  }
  return {
    ok: true,
    text: jina.text,
    transport: "jina_reader",
    status: jina.status,
    errorCode: null,
    errorMessage: null,
    usedAuthentication: jina.usedAuthentication,
    authenticationMode: jina.authenticationMode,
  };
}

async function latestCompleteSnapshotId(sourceKey: string) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client.from("macro_source_snapshots")
    .select("id")
    .eq("source_key", sourceKey)
    .eq("status", "complete")
    .order("capture_completed_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (error) throw new Error(`Could not read prior ${sourceKey} macro snapshot: ${error.message}`);
  return data?.id ?? null;
}

async function persistAttempt(source: MacroContextSource, transport: TransportResult, now: Date): Promise<SourceAttempt> {
  const client = createSupabaseAdminClient();
  const text = macroContextText(transport.text);
  const blockReason = transport.ok ? macroContextBlockReason(source, transport.text) : transport.errorCode || "transport_failed";
  const status: SourceAttempt["status"] = transport.ok
    ? blockReason ? "partial" : "complete"
    : "failed";
  const raw = transport.text ? transport.text.slice(0, RAW_CAPTURE_LIMIT) : null;
  const { data, error } = await client.from("macro_source_snapshots").insert({
    source_key: source.key,
    source_url: source.url,
    transport: transport.transport,
    schema_version: 1,
    capture_started_at: now.toISOString(),
    capture_completed_at: now.toISOString(),
    status,
    fingerprint: text ? macroContextFingerprint(text) : null,
    expected_sections: [],
    captured_sections: [],
    missing_sections: [],
    missing_required_table_families: [],
    table_count: 0,
    raw_markdown: raw,
    transport_status: transport.status,
    transport_error_code: blockReason,
    transport_error_message: transport.errorMessage?.slice(0, 500) || null,
    used_authentication: transport.usedAuthentication,
    authentication_mode: transport.authenticationMode,
  }).select("id").single<{ id: string }>();
  if (error || !data?.id) throw new Error(`Could not persist ${source.name} capture: ${error?.message || "missing snapshot id"}`);

  const note = status === "complete"
    ? `${source.name} produced usable non-placeholder macro context.`
    : status === "partial"
      ? `${source.name} was reachable but not usable as a complete macro context (${blockReason}).`
      : `${source.name} acquisition failed (${blockReason}).`;
  return { source, snapshotId: data.id, status, blockReason, transport: transport.transport, note };
}

export async function captureMacroContextSnapshot(options: { now?: Date; fetcher?: typeof fetch } = {}): Promise<MacroCaptureResult & { supplemental: SourceAttempt | null }> {
  const now = options.now ?? new Date();
  const currentBefore = await latestCompleteSnapshotId(DAILY_INVESTMENT_BRIEF_SOURCE.key);
  let primary: SourceAttempt;
  let supplemental: SourceAttempt | null = null;

  try {
    const acquired = await acquireSource(DAILY_INVESTMENT_BRIEF_SOURCE, {
      apiKey: process.env.JINA_API_KEY,
      fetcher: options.fetcher,
    });
    primary = await persistAttempt(DAILY_INVESTMENT_BRIEF_SOURCE, acquired, now);
  } catch (error) {
    return {
      status: "UNAVAILABLE",
      attemptSnapshotId: null,
      currentSnapshotId: currentBefore,
      fingerprint: null,
      tableCount: 0,
      note: `Daily Investment Brief primary macro capture is unavailable: ${error instanceof Error ? error.message : String(error)}`,
      supplemental: null,
    };
  }

  try {
    const acquired = await acquireSource(MACROMICRO_SOURCE, {
      apiKey: process.env.JINA_API_KEY,
      fetcher: options.fetcher,
    });
    supplemental = await persistAttempt(MACROMICRO_SOURCE, acquired, now);
  } catch (error) {
    supplemental = {
      source: MACROMICRO_SOURCE,
      snapshotId: null,
      status: "failed",
      blockReason: "capture_unavailable",
      transport: "direct_http",
      note: `MacroMicro supplemental capture is unavailable: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const currentSnapshotId = primary.status === "complete" ? primary.snapshotId : currentBefore;
  const status = primary.status === "complete" ? "COMPLETE" : primary.status === "partial" ? "PARTIAL" : "FAILED";
  return {
    status,
    attemptSnapshotId: primary.snapshotId,
    currentSnapshotId,
    fingerprint: null,
    tableCount: 0,
    note: `${primary.note} MacroMicro is supplemental only: ${supplemental.note}`,
    supplemental,
  };
}

export async function attachMacroContextCaptureToResearchRun(
  researchRunId: string,
  capture: MacroCaptureResult & { supplemental?: SourceAttempt | null },
) {
  const client = createSupabaseAdminClient();
  const { error } = await client.from("research_runs").update({
    macro_snapshot_id: capture.currentSnapshotId,
    macro_capture_attempt_id: capture.attemptSnapshotId,
    macro_capture_status: capture.status.toLocaleLowerCase("en-US"),
    macro_capture_note: capture.note.slice(0, 1_000),
  }).eq("id", researchRunId).eq("status", "running");
  if (error) throw new Error(`Could not attach primary macro-context lineage to research run: ${error.message}`);
}

export async function getPrimaryMacroContextHealth() {
  try {
    const client = createSupabaseAdminClient();
    const [complete, attempt] = await Promise.all([
      client.from("macro_source_snapshots")
        .select("id,capture_completed_at")
        .eq("source_key", DAILY_INVESTMENT_BRIEF_SOURCE.key)
        .eq("status", "complete")
        .order("capture_completed_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string; capture_completed_at: string }>(),
      client.from("macro_source_snapshots")
        .select("id,status,capture_completed_at,transport_status,transport_error_code,transport_error_message,authentication_mode")
        .eq("source_key", DAILY_INVESTMENT_BRIEF_SOURCE.key)
        .order("capture_completed_at", { ascending: false })
        .limit(1)
        .maybeSingle<{
          id: string;
          status: string;
          capture_completed_at: string;
          transport_status: number | null;
          transport_error_code: string | null;
          transport_error_message: string | null;
          authentication_mode: string | null;
        }>(),
    ]);
    if (complete.error) throw complete.error;
    if (attempt.error) throw attempt.error;
    return {
      sourceName: DAILY_INVESTMENT_BRIEF_SOURCE.name,
      sourceUrl: DAILY_INVESTMENT_BRIEF_SOURCE.url,
      supplementalSourceName: MACROMICRO_SOURCE.name,
      supplementalSourceUrl: MACROMICRO_SOURCE.url,
      latestCompleteSnapshotTimestamp: complete.data?.capture_completed_at ?? null,
      latestCaptureAttemptTimestamp: attempt.data?.capture_completed_at ?? null,
      latestAttemptStatus: attempt.data?.status ?? null,
      transportStatus: attempt.data?.transport_status ?? null,
      transportErrorCode: attempt.data?.transport_error_code ?? null,
      transportErrorMessage: attempt.data?.transport_error_message ?? null,
      authenticationMode: attempt.data?.authentication_mode ?? null,
      retainedPriorComplete: Boolean(complete.data?.id && attempt.data?.id && complete.data.id !== attempt.data.id && attempt.data.status !== "complete"),
    };
  } catch {
    return {
      sourceName: DAILY_INVESTMENT_BRIEF_SOURCE.name,
      sourceUrl: DAILY_INVESTMENT_BRIEF_SOURCE.url,
      supplementalSourceName: MACROMICRO_SOURCE.name,
      supplementalSourceUrl: MACROMICRO_SOURCE.url,
      latestCompleteSnapshotTimestamp: null,
      latestCaptureAttemptTimestamp: null,
      latestAttemptStatus: null,
      transportStatus: null,
      transportErrorCode: null,
      transportErrorMessage: null,
      authenticationMode: null,
      retainedPriorComplete: false,
    };
  }
}
