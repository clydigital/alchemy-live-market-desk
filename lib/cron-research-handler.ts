import { NextResponse } from "next/server";

import { POST as publishResearchUpdate } from "@/app/api/research-update/route";
import { buildScheduledResearchInputWithFirecrawl } from "@/lib/firecrawl-scheduled-research";
import { acceptsResearchAuthorization } from "@/lib/research-auth";
import { type CanonicalResearchSlot } from "@/lib/research-schedule-health";
import { scheduledForMalaysiaSlot, scheduledRunKey } from "@/lib/scheduled-research-input";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ClaimedRun = {
  id: string;
  status: "running" | "completed" | "blocked" | "failed";
  completed_at: string | null;
  updated_at: string;
};

type ClaimResult =
  | { state: "claimed"; run: ClaimedRun }
  | { state: "completed" | "running" | "terminal"; run: ClaimedRun };

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

function explicitRetryKey(request: Request, baseRunKey: string) {
  const retry = new URL(request.url).searchParams.get("retry")?.trim();
  if (!retry) return baseRunKey;
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/i.test(retry)) {
    throw new Error("The retry key must contain only letters, numbers, and hyphens and be at most 41 characters.");
  }
  return `${baseRunKey}:retry:${retry}`;
}

async function readRun(runKey: string) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("research_runs")
    .select("id,status,completed_at,updated_at")
    .eq("run_key", runKey)
    .maybeSingle<ClaimedRun>();
  if (error) throw new Error(`Could not read scheduled research run: ${error.message}`);
  return { client, run: data };
}

async function claimRun(slot: CanonicalResearchSlot, runKey: string, scheduledFor: string): Promise<ClaimResult> {
  const { client, run: existing } = await readRun(runKey);
  if (existing) {
    if (existing.status === "completed") return { state: "completed", run: existing };
    if (existing.status === "running") return { state: "running", run: existing };
    return { state: "terminal", run: existing };
  }
  const now = new Date().toISOString();
  const { data, error } = await client.from("research_runs").insert({
    run_key: runKey,
    schedule_slot: slot,
    scheduled_for: scheduledFor,
    started_at: now,
    status: "running",
    accuracy_gate: "blocked",
    required_sources_complete: false,
    evidence_gate_passed: false,
    source_checks: [],
    warnings: [],
    summary: "Scheduled Live-only acquisition is in progress.",
    updated_at: now,
  }).select("id,status,completed_at,updated_at").single<ClaimedRun>();
  if (!error && data) return { state: "claimed", run: data };
  if ((error as { code?: string } | null)?.code === "23505") {
    const raced = await readRun(runKey);
    if (!raced.run) throw new Error("A concurrent scheduled research claim could not be recovered.");
    if (raced.run.status === "completed") return { state: "completed", run: raced.run };
    if (raced.run.status === "running") return { state: "running", run: raced.run };
    return { state: "terminal", run: raced.run };
  }
  throw new Error(`Could not claim scheduled research run: ${error?.message || "unknown database error"}`);
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

/**
 * Vercel invokes this once for each explicit cadence. Acquisition and canonical
 * publication execute inside Live only; Hybrid is never called from this path.
 */
export async function handleScheduledResearch(request: Request, slot: CanonicalResearchSlot) {
  if (!cronAuthorised(request)) return response({ error: "Unauthorized Vercel Cron request." }, 401);
  if (!process.env.CRON_SECRET?.trim()) return response({ error: "CRON_SECRET is not configured." }, 503);
  if (!scheduledResearchEnabled()) {
    return response({
      status: "disabled",
      slot,
      message: "The Live research schedule is intentionally disabled.",
    });
  }

  const now = new Date();
  let runKey: string;
  try {
    runKey = explicitRetryKey(request, scheduledRunKey(slot, now));
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "Invalid scheduled retry key." }, 400);
  }
  const scheduledFor = scheduledForMalaysiaSlot(slot, now);
  let claim: ClaimResult;
  try {
    claim = await claimRun(slot, runKey, scheduledFor);
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "Could not claim scheduled research run." }, 503);
  }
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
    // Six external TranscriptAPI calls plus eight bounded OpenAI stages fit
    // inside the 300-second Vercel Cron function while cache hits stay free.
    const input = await buildScheduledResearchInputWithFirecrawl(slot, { now, maxTranscriptAttempts: 6, runKey });
    const internalRequest = new Request("https://live-internal.invalid/api/research-update", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
        "Content-Type": "application/json",
        "x-alchemy-scheduled-research": "1",
      },
      body: JSON.stringify(input),
    });
    const publication = await publishResearchUpdate(internalRequest);
    const result = await publication.json().catch(() => ({}));
    if (publication.status >= 400) {
      const detail = result && typeof result === "object" && "error" in result && typeof result.error === "string"
        ? result.error
        : `Publisher returned HTTP ${publication.status}.`;
      await markClaimFailed(claim.run.id, detail);
    }
    return response({
      slot,
      runKey,
      scheduledFor,
      acquisition: {
        sourceChecks: input.sourceChecks,
        retainedItems: input.items.length,
      },
      publication: result,
    }, publication.status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduled research failed.";
    await markClaimFailed(claim.run.id, message);
    return response({ error: message, slot, runKey, runId: claim.run.id }, 500);
  }
}
