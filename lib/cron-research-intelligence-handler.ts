import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  composeCanonicalDossierEditionForResearchRun,
  persistCanonicalJourneyEditionForResearchRun,
} from "@/lib/intelligence/canonical-journey-edition";
import {
  runWithIntelligenceInvocation,
  shouldDeferStageClaim,
} from "@/lib/intelligence/invocation-context";
import { OpenAIStageError, openAIIntelligenceEnabled } from "@/lib/intelligence/openai";
import { runIntelligenceEngine } from "@/lib/intelligence/runtime";
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

function handoffWarnings(
  warnings: string[],
  invokedStage: string | null,
  deferredStage: string | null,
) {
  const cleaned = warnings.filter((warning) => !/^Intelligence stage ".+" is already claimed by another continuation invocation\.$/.test(warning));
  if (!deferredStage) return cleaned;
  return mergeScheduledWarnings(cleaned, [
    `Canonical continuation handoff: ${invokedStage || "the current stage"} completed; ${deferredStage} is the next stage and was not started in the same invocation.`,
  ]);
}

/**
 * Scheduled intelligence gives one model stage to one durable invocation.
 * Completed checkpoints are replayed from the same engine run. After research
 * completes, the immutable base edition is persisted without model work. The
 * Dossier storyline composer is then deferred into its own fresh invocation,
 * preserving the same one-model-stage rule for edition-level composition.
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

    const invocation = await runWithIntelligenceInvocation({ oneModelStage: true }, async () => {
      const intelligence = await runIntelligenceEngine({
        researchRunId: run.id,
        triggerKind: "new_evidence",
        runKey: `research:${runKey}`,
        dryRun: run.accuracy_gate === "blocked",
        stageMaxAttempts: 1,
      });
      const finalStatus = finalScheduledResearchStatus(run.accuracy_gate, intelligence.status);
      if (intelligence.status === "partial" || finalStatus !== "completed") {
        return { intelligence, dossierComposition: null, dossierCompositionError: null };
      }

      await persistCanonicalJourneyEditionForResearchRun({
        researchRunId: run.id,
        runKey,
        publicSummary: run.summary,
      });

      if (shouldDeferStageClaim("dossier_storyline_composer")) {
        return { intelligence, dossierComposition: null, dossierCompositionError: null };
      }

      try {
        const dossierComposition = await composeCanonicalDossierEditionForResearchRun({
          researchRunId: run.id,
        });
        return { intelligence, dossierComposition, dossierCompositionError: null };
      } catch (error) {
        if (error instanceof OpenAIStageError) {
          return {
            intelligence,
            dossierComposition: null,
            dossierCompositionError: {
              message: error.message,
              retryable: error.retryable,
              code: error.code,
            },
          };
        }
        throw error;
      }
    });
    const intelligence = invocation.value.intelligence;
    let warnings = handoffWarnings(
      mergeScheduledWarnings(claimedWarnings, intelligence.warnings),
      invocation.summary.invokedModelStage,
      invocation.summary.deferredStage,
    );

    if (intelligence.status === "partial") {
      const resumableWarnings = mergeScheduledWarnings(
        warnings,
        [intelligenceContinuationReleaseWarning()],
      );
      await persistResumableRun({ runId: run.id, warnings: resumableWarnings });
      return response({
        status: "partial",
        continuation: invocation.summary.deferredStage ? "CONTINUE" : "RETRY_STAGE",
        completedStage: invocation.summary.invokedModelStage,
        nextStage: invocation.summary.deferredStage,
        slot,
        runKey,
        runId: run.id,
        scheduledFor,
        message: invocation.summary.deferredStage
          ? `One model stage completed. Continue from ${invocation.summary.deferredStage} in a fresh invocation.`
          : "The current stage did not complete. Retry the same persisted stage without rerunning completed upstream work.",
        intelligence,
        warnings: resumableWarnings,
      }, 202);
    }

    const finalStatus = finalScheduledResearchStatus(run.accuracy_gate, intelligence.status);
    const updatesPublished = intelligence.storiesPublished || 0;

    if (finalStatus === "completed" && invocation.summary.deferredStage === "dossier_storyline_composer") {
      const resumableWarnings = mergeScheduledWarnings(
        warnings,
        [intelligenceContinuationReleaseWarning()],
      );
      await persistResumableRun({ runId: run.id, warnings: resumableWarnings });
      return response({
        status: "partial",
        continuation: "COMPOSE_DOSSIER",
        completedStage: invocation.summary.invokedModelStage,
        nextStage: "dossier_storyline_composer",
        slot,
        runKey,
        runId: run.id,
        scheduledFor,
        updatesPublished,
        intelligence,
        warnings: resumableWarnings,
        message: "Canonical research and the immutable base edition are complete. Continue with Dossier causal composition in a fresh invocation.",
      }, 202);
    }

    const compositionError = invocation.value.dossierCompositionError;
    if (finalStatus === "completed" && compositionError?.retryable) {
      const resumableWarnings = mergeScheduledWarnings(warnings, [
        `Dossier storyline composer will retry: ${compositionError.message}`,
        intelligenceContinuationReleaseWarning(),
      ]);
      await persistResumableRun({ runId: run.id, warnings: resumableWarnings });
      return response({
        status: "partial",
        continuation: "RETRY_DOSSIER_COMPOSER",
        completedStage: invocation.summary.invokedModelStage,
        nextStage: "dossier_storyline_composer",
        slot,
        runKey,
        runId: run.id,
        scheduledFor,
        updatesPublished,
        intelligence,
        warnings: resumableWarnings,
        message: "The canonical base edition is safe; retry the Dossier storyline composer without rerunning completed research stages.",
      }, 202);
    }

    if (finalStatus === "completed" && compositionError) {
      warnings = mergeScheduledWarnings(warnings, [
        `Dossier storyline composition degraded to the persisted base edition: ${compositionError.message}`,
      ]);
    }
    if (invocation.value.dossierComposition?.warnings?.length) {
      warnings = mergeScheduledWarnings(warnings, invocation.value.dossierComposition.warnings);
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
      continuation: finalStatus === "completed" ? "COMPLETED" : "TERMINAL_FAILURE",
      slot,
      runKey,
      runId: run.id,
      scheduledFor,
      updatesPublished,
      intelligence,
      dossierComposition: invocation.value.dossierComposition,
      warnings,
    }, finalStatus === "completed" ? 200 : finalStatus === "failed" ? 500 : 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduled intelligence continuation failed.";
    await markUnexpectedFailure(run.id, claimedWarnings, message);
    return response({ error: message, continuation: "TERMINAL_FAILURE", slot, runKey, runId: run.id, scheduledFor }, 500);
  }
}
