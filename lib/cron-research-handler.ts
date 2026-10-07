import { NextResponse } from "next/server";

import { POST as publishResearchUpdate } from "@/app/api/research-update/route";
import { buildScheduledResearchInputWithFirecrawl } from "@/lib/firecrawl-scheduled-research";
import {
  attachMacroContextCaptureToResearchRun,
  captureMacroContextSnapshot,
} from "@/lib/macro/macro-context-capture-supabase";
import { ingestOfficialMacroActuals, type OfficialActualIngestionResult } from "@/lib/macro/official-actuals";
import { acceptsResearchAuthorization } from "@/lib/research-auth";
import { type CanonicalResearchSlot } from "@/lib/research-schedule-health";
import {
  abandonedScheduledRunEligible,
  buildScheduledResearchLogEvent,
  type ClaimedRun,
  claimRunWithDependencies,
  type ClaimInsertInput,
  type ClaimResult,
  resolveScheduledResearchIdentity,
  type ScheduledResearchLogEvent,
} from "@/lib/scheduled-research-identity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ScheduledResearchHandlerDependencies = {
  cronAuthorised?: (request: Request) => boolean;
  scheduledResearchEnabled?: () => boolean;
  now?: () => Date;
  claimRun?: (slot: CanonicalResearchSlot, runKey: string, scheduledFor: string) => Promise<ClaimResult>;
  buildScheduledResearchInput?: typeof buildScheduledResearchInputWithFirecrawl;
  captureMacroContext?: typeof captureMacroContextSnapshot;
  ingestOfficialActuals?: typeof ingestOfficialMacroActuals;
  attachMacroContext?: typeof attachMacroContextCaptureToResearchRun;
  publishResearchUpdate?: typeof publishResearchUpdate;
  markClaimFailed?: (id: string, message: string) => Promise<void>;
  recoverAbandonedRuns?: (now: Date) => Promise<{ recoveredCount: number }>;
  logger?: (event: ScheduledResearchLogEvent) => void;
};

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function scheduledResearchEnabled() {
  return process.env.NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED === "true";
}

function cronAuthorised(request: Request) {
  return acceptsResearchAuthorization(request.headers.get("authorization"), [process.env.CRON_SECRET]);
}

type AbandonedSlotRun = {
  research_run_id: string;
  slot_key: string;
  status: string;
  last_heartbeat_at: string | null;
  warnings: string[] | null;
};

type AbandonedParentRun = {
  id: string;
  run_key: string;
  schedule_slot: string;
  status: string;
  updated_at: string;
  warnings: string[] | null;
};

type AbandonedEngineRun = {
  id: string;
  status: string;
  completed_at: string | null;
  failure_detail: string | null;
};

async function recoverAbandonedScheduledResearchRuns(now = new Date()) {
  const client = createSupabaseAdminClient();
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1_000).toISOString();
  const completedAt = now.toISOString();

  const { data: slotRuns, error: slotError } = await client
    .from("research_slot_runs")
    .select("research_run_id,slot_key,status,last_heartbeat_at,warnings")
    .in("slot_key", ["morning", "evening"])
    .eq("status", "running")
    .lt("last_heartbeat_at", cutoff);

  if (slotError) {
    throw new Error(`Could not inspect abandoned scheduled Live runs: ${slotError.message}`);
  }

  let recoveredCount = 0;
  for (const slotRun of (slotRuns ?? []) as AbandonedSlotRun[]) {
    const [{ data: parent, error: parentError }, { data: engine, error: engineError }] = await Promise.all([
      client
        .from("research_runs")
        .select("id,run_key,schedule_slot,status,updated_at,warnings")
        .eq("id", slotRun.research_run_id)
        .maybeSingle<AbandonedParentRun>(),
      client
        .from("intelligence_engine_runs")
        .select("id,status,completed_at,failure_detail")
        .eq("research_run_id", slotRun.research_run_id)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle<AbandonedEngineRun>(),
    ]);

    if (parentError) {
      throw new Error(`Could not read abandoned parent research run: ${parentError.message}`);
    }
    if (engineError) {
      throw new Error(`Could not read abandoned intelligence run: ${engineError.message}`);
    }
    if (!parent) continue;

    if (!abandonedScheduledRunEligible({
      runStatus: parent.status,
      slotStatus: slotRun.status,
      slotKey: slotRun.slot_key,
      lastHeartbeatAt: slotRun.last_heartbeat_at,
      engineStatus: engine?.status ?? null,
    }, now)) {
      continue;
    }

    const warning =
      `[orchestration] abandoned scheduled Live run ${parent.run_key} was terminalised after more than 24 hours without a heartbeat; persisted evidence and stage history were preserved.`;
    const parentWarnings = [...(parent.warnings ?? [])];
    if (!parentWarnings.includes(warning)) parentWarnings.push(warning);

    const { data: updatedParent, error: parentUpdateError } = await client
      .from("research_runs")
      .update({
        status: "failed",
        completed_at: completedAt,
        warnings: parentWarnings,
        updated_at: completedAt,
      })
      .eq("id", parent.id)
      .eq("status", "running")
      .eq("updated_at", parent.updated_at)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (parentUpdateError) {
      throw new Error(`Could not terminalise abandoned scheduled Live run: ${parentUpdateError.message}`);
    }
    if (!updatedParent) continue;

    const slotWarnings = [...(slotRun.warnings ?? [])];
    if (!slotWarnings.includes(warning)) slotWarnings.push(warning);
    const { error: slotUpdateError } = await client
      .from("research_slot_runs")
      .update({
        status: "failed",
        health_state: "blocked",
        completed_at: completedAt,
        last_heartbeat_at: completedAt,
        stage_summary: {
          lastStage: "abandoned_run_recovery",
          lastStatus: "failed",
          reason: "heartbeat_stale_over_24h",
        },
        warnings: slotWarnings,
        updated_at: completedAt,
      })
      .eq("research_run_id", parent.id)
      .eq("status", "running")
      .eq("last_heartbeat_at", slotRun.last_heartbeat_at);

    if (slotUpdateError) {
      throw new Error(`Parent run is terminal but slot cleanup failed: ${slotUpdateError.message}`);
    }

    if (engine && ["started", "partial"].includes(engine.status)) {
      const detail = [engine.failure_detail, warning].filter(Boolean).join(" ");
      await client
        .from("intelligence_engine_runs")
        .update({
          status: "failed",
          completed_at: completedAt,
          failure_detail: detail.slice(0, 2_000),
        })
        .eq("id", engine.id)
        .in("status", ["started", "partial"]);
    }

    recoveredCount += 1;
  }

  return { recoveredCount };
}

async function readRun(runKey: string) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("research_runs")
    .select("id,status,completed_at,updated_at,source_checks")
    .eq("run_key", runKey)
    .maybeSingle<ClaimedRun>();
  if (error) throw new Error(`Could not read scheduled research run: ${error.message}`);
  return data;
}

async function insertRun(input: ClaimInsertInput) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client.from("research_runs").insert({
    run_key: input.runKey,
    schedule_slot: input.slot,
    scheduled_for: input.scheduledFor,
    started_at: input.startedAt,
    status: "running",
    accuracy_gate: "blocked",
    required_sources_complete: false,
    evidence_gate_passed: false,
    source_checks: [],
    warnings: [],
    summary: "Scheduled Live-only acquisition is in progress.",
    updated_at: input.updatedAt,
  }).select("id,status,completed_at,updated_at,source_checks").single<ClaimedRun>();
  if (!error && data) return data;
  const failure = new Error(`Could not claim scheduled research run: ${error?.message || "unknown database error"}`) as Error & {
    code?: string;
  };
  failure.code = (error as { code?: string } | null)?.code;
  throw failure;
}

async function reclaimStaleAcquisitionRun(
  existing: ClaimedRun,
  input: ClaimInsertInput,
): Promise<ClaimedRun | null> {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("research_runs")
    .update({
      started_at: input.startedAt,
      completed_at: null,
      updated_at: input.updatedAt,
    })
    .eq("id", existing.id)
    .eq("status", "running")
    .eq("updated_at", existing.updated_at)
    .select("id,status,completed_at,updated_at,source_checks")
    .maybeSingle<ClaimedRun>();
  if (error) throw new Error(`Could not reclaim stale scheduled acquisition: ${error.message}`);
  return data;
}

async function claimRun(slot: CanonicalResearchSlot, runKey: string, scheduledFor: string): Promise<ClaimResult> {
  return claimRunWithDependencies(slot, runKey, scheduledFor, {
    readRun,
    insertRun,
    reclaimRun: reclaimStaleAcquisitionRun,
  });
}

async function markClaimFailed(id: string, message: string) {
  try {
    const client = createSupabaseAdminClient();
    await client.from("research_runs").update({
      status: "failed",
      completed_at: new Date().toISOString(),
      warnings: [message.slice(0, 1_000)],
      updated_at: new Date().toISOString(),
    }).eq("id", id).eq("status", "running");
  } catch {
    // The primary cron failure response is still more useful than a secondary ledger failure.
  }
}

function logScheduledResearchEvent(event: ScheduledResearchLogEvent) {
  console.info(JSON.stringify(event));
}

async function safeOfficialActualIngestion(
  ingest: typeof ingestOfficialMacroActuals,
  now: Date,
): Promise<OfficialActualIngestionResult> {
  try {
    return await ingest({ now });
  } catch (error) {
    return {
      attempted: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      completedReleaseIds: [],
      failedReleaseIds: [],
      note: `Official Actual ingestion collector is degraded: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Vercel invokes this once for each explicit cadence. Acquisition and canonical
 * publication execute inside Live only; Hybrid is never called from this path.
 */
export async function handleScheduledResearchWithDependencies(
  request: Request,
  slot: CanonicalResearchSlot,
  dependencies: ScheduledResearchHandlerDependencies = {},
) {
  const logger = dependencies.logger ?? logScheduledResearchEvent;
  const now = dependencies.now?.() ?? new Date();
  const cronReceivedAt = now.toISOString();
  const logEvent = (event: ScheduledResearchLogEvent["event"], extra: Omit<Partial<ScheduledResearchLogEvent>, "event" | "slot" | "cronReceivedAt"> = {}) => {
    logger(buildScheduledResearchLogEvent({
      event,
      request,
      slot,
      now: new Date(cronReceivedAt),
      extra,
    }));
  };

  logEvent("scheduled_research_received");

  const authorised = (dependencies.cronAuthorised ?? cronAuthorised)(request);
  logEvent("scheduled_research_auth", { authStatus: authorised ? "authorized" : "unauthorized" });
  if (!authorised) return response({ error: "Unauthorized Vercel Cron request." }, 401);
  if (!process.env.CRON_SECRET?.trim()) return response({ error: "CRON_SECRET is not configured." }, 503);
  if (!(dependencies.scheduledResearchEnabled ?? scheduledResearchEnabled)()) {
    return response({
      status: "disabled",
      slot,
      message: "The Live research schedule is intentionally disabled.",
    });
  }

  try {
    const recovery = await (dependencies.recoverAbandonedRuns ?? recoverAbandonedScheduledResearchRuns)(now);
    if (recovery.recoveredCount > 0) {
      logEvent("scheduled_research_abandoned_runs_recovered", {
        authStatus: "authorized",
        message: `Terminalised ${recovery.recoveredCount} abandoned scheduled Live run(s) before claiming the current occurrence.`,
      });
    }
  } catch (error) {
    logEvent("scheduled_research_abandoned_run_recovery_failed", {
      authStatus: "authorized",
      message: error instanceof Error ? error.message : "Could not recover abandoned scheduled Live runs.",
    });
  }

  let runKey: string;
  let scheduledFor: string;
  try {
    ({ runKey, scheduledFor } = resolveScheduledResearchIdentity(request, slot, now));
  } catch (error) {
    logEvent("scheduled_research_identity_invalid", {
      authStatus: "authorized",
      message: error instanceof Error ? error.message : "Invalid scheduled retry key.",
    });
    return response({ error: error instanceof Error ? error.message : "Invalid scheduled retry key." }, 400);
  }
  logEvent("scheduled_research_claim_attempt", {
    authStatus: "authorized",
    scheduledFor,
    runKey,
  });

  let claim: ClaimResult;
  try {
    claim = await (dependencies.claimRun ?? claimRun)(slot, runKey, scheduledFor);
  } catch (error) {
    logEvent("scheduled_research_claim_failed", {
      authStatus: "authorized",
      scheduledFor,
      runKey,
      claimOutcome: "failed",
      message: error instanceof Error ? error.message : "Could not claim scheduled research run.",
    });
    return response({ error: error instanceof Error ? error.message : "Could not claim scheduled research run." }, 503);
  }
  logEvent("scheduled_research_claim_result", {
    authStatus: "authorized",
    scheduledFor,
    runKey,
    claimOutcome: claim.state,
    runId: claim.run.id,
  });
  if (claim.state !== "claimed") {
    return response({
      status: claim.state === "terminal" ? "not_retried" : claim.state,
      slot,
      runKey,
      runId: claim.run.id,
      message: claim.state === "completed"
        ? "This scheduled run already completed; no provider or OpenAI work was repeated."
        : claim.state === "running"
          ? "This scheduled run is already in progress."
          : "This scheduled run reached a terminal state and requires an explicit audited retry key.",
    });
  }

  try {
    logEvent("scheduled_research_acquisition_start", {
      authStatus: "authorized",
      scheduledFor,
      runKey,
      claimOutcome: claim.state,
      runId: claim.run.id,
    });
    // Independent deterministic collectors run beside news/transcript intake.
    // Daily Investment Brief remains a separate research-context collector.
    // Canonical Dossier macro/rates state comes from FRED and official providers,
    // so this collector never gates unrelated evidence or Story work.
    const macroCapturePromise = (dependencies.captureMacroContext ?? captureMacroContextSnapshot)({ now });
    const officialActuals = await safeOfficialActualIngestion(
      dependencies.ingestOfficialActuals ?? ingestOfficialMacroActuals,
      now,
    );
    const [input, macroCapture] = await Promise.all([
      (dependencies.buildScheduledResearchInput ?? buildScheduledResearchInputWithFirecrawl)(slot, {
        now,
        runKey,
      }),
      macroCapturePromise,
    ]);

    let macroLineagePersisted = false;
    let macroLineageNote: string | null = null;
    try {
      await (dependencies.attachMacroContext ?? attachMacroContextCaptureToResearchRun)(claim.run.id, macroCapture);
      macroLineagePersisted = true;
    } catch (error) {
      macroLineageNote = error instanceof Error ? error.message : "Could not attach macro-source lineage to the run.";
    }

    const internalRequest = new Request("https://live-internal.invalid/api/research-update", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
        "Content-Type": "application/json",
        "x-alchemy-scheduled-research": "1",
        "x-alchemy-scheduled-research-started-at": cronReceivedAt,
      },
      body: JSON.stringify(input),
    });
    logEvent("scheduled_research_publisher_start", {
      authStatus: "authorized",
      scheduledFor,
      runKey,
      claimOutcome: claim.state,
      runId: claim.run.id,
      acquisitionSourceCount: input.sourceChecks.length,
      retainedItems: input.items.length,
    });
    const publication = await (dependencies.publishResearchUpdate ?? publishResearchUpdate)(internalRequest);
    const result = await publication.json().catch(() => ({}));
    logEvent("scheduled_research_publisher_result", {
      authStatus: "authorized",
      scheduledFor,
      runKey,
      claimOutcome: claim.state,
      runId: claim.run.id,
      publisherStatus: publication.status,
      acquisitionSourceCount: input.sourceChecks.length,
      retainedItems: input.items.length,
    });
    if (publication.status >= 400) {
      const detail = result && typeof result === "object" && "error" in result && typeof result.error === "string"
        ? result.error
        : `Publisher returned HTTP ${publication.status}.`;
      await (dependencies.markClaimFailed ?? markClaimFailed)(claim.run.id, detail);
    }
    return response({
      slot,
      runKey,
      scheduledFor,
      acquisition: {
        sourceChecks: input.sourceChecks,
        retainedItems: input.items.length,
        officialActuals,
        macro: {
          ...macroCapture,
          runLineagePersisted: macroLineagePersisted,
          lineageNote: macroLineageNote,
        },
      },
      publication: result,
    }, publication.status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduled research failed.";
    logEvent("scheduled_research_failed", {
      authStatus: "authorized",
      scheduledFor,
      runKey,
      claimOutcome: "failed",
      runId: claim.run.id,
      message,
    });
    await (dependencies.markClaimFailed ?? markClaimFailed)(claim.run.id, message);
    return response({ error: message, slot, runKey, runId: claim.run.id }, 500);
  }
}

export async function handleScheduledResearch(request: Request, slot: CanonicalResearchSlot) {
  return handleScheduledResearchWithDependencies(request, slot);
}
