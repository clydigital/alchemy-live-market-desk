import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { openAIIntelligenceEnabled } from "@/lib/intelligence/openai";
import {
  persistCanonicalEditionForResearchRun,
  runIntelligenceEngine,
} from "@/lib/intelligence/runtime";
import { acceptsResearchAuthorization } from "@/lib/research-auth";
import { type CanonicalResearchSlot } from "@/lib/research-schedule-health";
import {
  evaluateScheduledIntelligenceContinuation,
  finalScheduledResearchStatus,
  intelligenceContinuationClaimWarning,
  intelligenceContinuationReleaseWarning,
  mergeScheduledWarnings,
  type ScheduledContinuationRun,
} from "@/lib/scheduled-intelligence-continuation";
import { resolveScheduledResearchIdentity } from "@/lib/scheduled-research-identity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function authorised(request: Request) {
  return acceptsResearchAuthorization(request.headers.get("authorization"), [process.env.CRON_SECRET]);
}

function scheduledResearchEnabled() {
  return process.env.NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED === "true";
}

async function readRun(runKey: string) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("research_runs")
    .select("id,status,accuracy_gate,source_checks,warnings,summary,updates_published,updated_at")
    .eq("run_key", runKey)
    .maybeSingle<ScheduledContinuationRun>();
  if (error) throw new Error(`Could not read scheduled research continuation: ${error.message}`);
  return data;
}

async function claimContinuation(run: ScheduledContinuationRun, now: Date) {
  const client = createSupabaseAdminClient();
  const claimWarning = intelligenceContinuationClaimWarning(now);
  const warnings = mergeScheduledWarnings(run.warnings, [claimWarning]);
  const { data, error } = await client
    .from("research_runs")
    .update({ warnings, updated_at: now.toISOString() })
    .eq("id", run.id)
    .eq("status", "running")
    .eq("updated_at", run.updated_at)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) throw new Error(`Could not claim scheduled intelligence continuation: ${error.message}`);
  return data ? { claimed: true as const, warnings } : { claimed: false as const, warnings: run.warnings ?? [] };
}

async function persistFinalRun(input: {
  runId: string;
  status: "completed" | "blocked" | "failed";
  updatesPublished: number;
  warnings: string[];
}) {
  const client = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await client
    .from("research_runs")
    .update({
      status: input.status,
      completed_at: now,
      updates_published: input.updatesPublished,
      warnings: input.warnings,
      updated_at: now,
    })
    .eq("id", input.runId)
    .eq("status", "running");
  if (error) throw new Error(`Could not finalise scheduled research continuation: ${error.message}`);
}

async function persistResumableRun(input: {
  runId: string;
  warnings: string[];
}) {
  const client = createSupabaseAdminClient();
  const { error } = await client
    .from("research_runs")
    .update({
      // Keep the canonical acquisition lineage open: a later cron or manual
      // continuation must resume this engine run instead of making a new edition.
      status: "running",
      completed_at: null,
      warnings: input.warnings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.runId)
    .eq("status", "running");
  if (error) throw new Error(`Could not persist resumable scheduled intelligence state: ${error.message}`);
}

async function markUnexpectedFailure(runId: string, warnings: string[], message: string) {
  try {
    await persistFinalRun({
      runId,
      status: "failed",
      updatesPublished: 0,
      warnings: mergeScheduledWarnings(warnings, [message]),
    });
  } catch {
    // Preserve the original continuation error.
  }
}

/**
 * Runs the Live-owned OpenAI reasoning chain only after the scheduled acquisition
 * invocation has durably persisted its intake. This gives intelligence a fresh
 * serverless deadline instead of sharing one 300-second request with providers.
 */
export async function handleScheduledResearchIntelligence(
  request: Request,
  slot: CanonicalResearchSlot,
) {
  if (!authorised(request)) return response({ error: "Unauthorized Vercel Cron request." }, 401);
  if (!process.env.CRON_SECRET?.trim()) return response({ error: "CRON_SECRET is not configured." }, 503);
  if (!scheduledResearchEnabled()) {
    return response({ status: "disabled", slot, message: "The Live research schedule is intentionally disabled." });
  }
  if (!openAIIntelligenceEnabled()) {
    return response({ status: "unavailable", slot, message: "OpenAI intelligence is not configured." }, 503);
  }

  const now = new Date();
  let runKey: string;
  let scheduledFor: string;
  try {
    ({ runKey, scheduledFor } = resolveScheduledResearchIdentity(request, slot, now));
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "Invalid scheduled retry key." }, 400);
  }

  let run: ScheduledContinuationRun | null;
  try {
    run = await readRun(runKey);
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "Could not read scheduled research run." }, 503);
  }

  const decision = evaluateScheduledIntelligenceContinuation(run, now);
  if (decision.state !== "ready" || !run) {
    const status = decision.state === "completed" || decision.state === "terminal" ? 200 : 202;
    return response({
      status: decision.state,
      slot,
      runKey,
      runId: run?.id ?? null,
      scheduledFor,
      message: decision.reason,
    }, status);
  }

  let claimedWarnings = run.warnings ?? [];
  try {
    const claim = await claimContinuation(run, now);
    if (!claim.claimed) {
      return response({
        status: "intelligence_race_lost",
        slot,
        runKey,
        runId: run.id,
        scheduledFor,
        message: "Another continuation invocation changed the canonical run first; no duplicate model work was started.",
      }, 202);
    }
    claimedWarnings = claim.warnings;

    const intelligenceStartedAtMs = Date.now();
    const intelligence = await runIntelligenceEngine({
      researchRunId: run.id,
      triggerKind: "new_evidence",
      runKey: `research:${runKey}`,
      dryRun: run.accuracy_gate === "blocked",
      scheduledExecutionStartedAtMs: intelligenceStartedAtMs,
      stageMaxAttempts: 1,
    });
    const warnings = mergeScheduledWarnings(claimedWarnings, intelligence.warnings);
    if (intelligence.status === "partial") {
      const resumableWarnings = mergeScheduledWarnings(
        warnings,
        [intelligenceContinuationReleaseWarning()],
      );
      await persistResumableRun({ runId: run.id, warnings: resumableWarnings });
      return response({
        status: "partial",
        slot,
        runKey,
        runId: run.id,
        scheduledFor,
        message: "A bounded intelligence stage attempt stopped. Completed checkpoints remain attached to this canonical research run and the next continuation will resume from the first incomplete stage.",
        intelligence,
        warnings: resumableWarnings,
      }, 202);
    }
    const finalStatus = finalScheduledResearchStatus(run.accuracy_gate, intelligence.status);
    const updatesPublished = intelligence.storiesPublished || 0;

    if (finalStatus === "completed") {
      await persistCanonicalEditionForResearchRun({
        researchRunId: run.id,
        runKey,
        publicSummary: run.summary,
      });
    }

    await persistFinalRun({
      runId: run.id,
      status: finalStatus,
      updatesPublished,
      warnings,
    });

    revalidatePath("/");
    revalidatePath("/stories");
    revalidatePath("/data/macro");
    revalidatePath("/api/hybrid-feed");
    revalidatePath("/api/hybrid-feed-v2");

    return response({
      status: finalStatus,
      slot,
      runKey,
      runId: run.id,
      scheduledFor,
      updatesPublished,
      intelligence,
      warnings,
    }, finalStatus === "completed" ? 200 : finalStatus === "failed" ? 500 : 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduled intelligence continuation failed.";
    await markUnexpectedFailure(run.id, claimedWarnings, message);
    return response({ error: message, slot, runKey, runId: run.id, scheduledFor }, 500);
  }
}
