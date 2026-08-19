import { NextResponse } from "next/server";

import { POST as publishResearchUpdate } from "@/app/api/research-update/route";
import { buildScheduledResearchInputWithFirecrawl } from "@/lib/firecrawl-scheduled-research";
import {
  attachMacroCaptureToResearchRun,
  captureMacroIndicatorsSnapshot,
} from "@/lib/macro/macro-capture-supabase";
import { acceptsResearchAuthorization } from "@/lib/research-auth";
import { type CanonicalResearchSlot } from "@/lib/research-schedule-health";
import {
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
  captureMacroIndicators?: typeof captureMacroIndicatorsSnapshot;
  attachMacroCapture?: typeof attachMacroCaptureToResearchRun;
  publishResearchUpdate?: typeof publishResearchUpdate;
  markClaimFailed?: (id: string, message: string) => Promise<void>;
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

async function readRun(runKey: string) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("research_runs")
    .select("id,status,completed_at,updated_at")
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
  }).select("id,status,completed_at,updated_at").single<ClaimedRun>();
  if (!error && data) return data;
  const failure = new Error(`Could not claim scheduled research run: ${error?.message || "unknown database error"}`) as Error & {
    code?: string;
  };
  failure.code = (error as { code?: string } | null)?.code;
  throw failure;
}

async function claimRun(slot: CanonicalResearchSlot, runKey: string, scheduledFor: string): Promise<ClaimResult> {
  return claimRunWithDependencies(slot, runKey, scheduledFor, {
    readRun,
    insertRun,
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
    // Macro Indicators capture is an independent deterministic collector. Run it
    // in parallel with news/transcript acquisition so it cannot serially consume
    // the research route's reasoning budget.
    const [input, macroCapture] = await Promise.all([
      (dependencies.buildScheduledResearchInput ?? buildScheduledResearchInputWithFirecrawl)(slot, {
        now,
        runKey,
      }),
      (dependencies.captureMacroIndicators ?? captureMacroIndicatorsSnapshot)(),
    ]);

    let macroLineagePersisted = false;
    let macroLineageNote: string | null = null;
    try {
      await (dependencies.attachMacroCapture ?? attachMacroCaptureToResearchRun)(claim.run.id, macroCapture);
      macroLineagePersisted = true;
    } catch (error) {
      macroLineageNote = error instanceof Error ? error.message : "Could not attach Macro Indicators lineage to the run.";
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
