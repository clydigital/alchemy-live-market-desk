import { createSupabaseAdminClient } from "./supabase/admin.ts";
import { acceptsResearchAuthorization } from "./research-auth.ts";
import { runManualDossierV2 } from "./dossier-v2/manual-run.ts";
import { syncLatestPrioritisedResearchGapCasesWithD7 } from "./d7-research-gap-runtime.ts";

/**
 * Vercel-primary post-research handoff. Reuses the existing Dossier V2 System 2
 * and the existing slot-run operational checkpoint; no new reasoning store.
 * The GitHub Actions OIDC endpoint remains separate and unchanged.
 */
export const POST_RESEARCH_DOSSIER_V1 = "post-research-dossier/1" as const;
export type PostResearchSlot = "morning" | "evening";
export type PostResearchCheckpoint = {
  contractVersion: typeof POST_RESEARCH_DOSSIER_V1;
  state: "RUNNING" | "DONE" | "FAILED";
  attempt: number;
  claimedAt: string;
  finishedAt?: string;
  outcome?: "PERSISTED" | "NO_CHANGE" | "ALREADY_CURRENT";
  dossierId?: string | null;
  error?: string;
  researchGapSync?: "synced" | "empty" | "failed";
};

export type PostResearchRun = {
  id: string;
  completed_at: string | null;
  scheduled_for: string;
  status: string;
};
export type PostResearchSlotRun = {
  id: string;
  research_run_id: string;
  slot_key: string;
  status: string;
  health_state: string | null;
  live_publication_status: string | null;
  hybrid_handoff_status: string | null;
  stage_summary: Record<string, unknown> | null;
  updated_at: string;
};

const CLAIM_STALE_MS = 7 * 60_000;
const RESEARCH_WINDOW_MS = 5 * 60 * 60_000;
const MAX_ATTEMPTS = 2;

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function postResearchEligibility(
  run: PostResearchRun | null,
  slot: PostResearchSlotRun | null,
  now: Date,
): { eligible: boolean; reason: string; previous: PostResearchCheckpoint | null } {
  if (!run || !slot || run.id !== slot.research_run_id)
    return { eligible: false, reason: "completed_run_unavailable", previous: null };
  if (run.status !== "completed" || slot.status !== "completed"
    || slot.health_state !== "healthy"
    || slot.live_publication_status !== "complete"
    || slot.hybrid_handoff_status !== "complete")
    return { eligible: false, reason: "canonical_publication_incomplete", previous: null };
  const gate = object(slot.stage_summary);
  if (gate.evidence_gate_passed !== true || gate.required_sources_complete !== true
    || gate.accuracy_gate === "blocked")
    return { eligible: false, reason: "canonical_evidence_gate_incomplete", previous: null };
  const completedAt = Date.parse(run.completed_at || "");
  const scheduledAt = Date.parse(run.scheduled_for);
  if (!Number.isFinite(completedAt) || completedAt > now.getTime()
    || !Number.isFinite(scheduledAt) || scheduledAt > now.getTime()
    || now.getTime() - scheduledAt > RESEARCH_WINDOW_MS)
    return { eligible: false, reason: "outside_post_research_window", previous: null };

  const previousRaw = object(gate.postResearchDossier);
  const previous = previousRaw.contractVersion === POST_RESEARCH_DOSSIER_V1
    ? previousRaw as PostResearchCheckpoint : null;
  if (previous?.state === "DONE")
    return { eligible: false, reason: "dossier_decision_recorded", previous };
  if (previous && previous.attempt >= MAX_ATTEMPTS)
    return { eligible: false, reason: "dossier_retry_budget_exhausted", previous };
  if (previous?.state === "RUNNING") {
    const claimedAt = Date.parse(previous.claimedAt);
    if (!Number.isFinite(claimedAt) || now.getTime() - claimedAt < CLAIM_STALE_MS)
      return { eligible: false, reason: "dossier_claim_active", previous };
  }
  return { eligible: true, reason: "ready", previous };
}

type PostResearchDependencies = {
  authorize?: (request: Request) => boolean;
  now?: () => Date;
  client?: ReturnType<typeof createSupabaseAdminClient>;
  run?: typeof runManualDossierV2;
  sync?: typeof syncLatestPrioritisedResearchGapCasesWithD7;
  enabled?: () => boolean;
};

export async function handleScheduledPostResearchDossier(
  request: Request,
  slot: PostResearchSlot,
  deps: PostResearchDependencies = {},
) {
  const authorize = deps.authorize ?? ((req: Request) =>
    Boolean(process.env.CRON_SECRET?.trim())
    && acceptsResearchAuthorization(req.headers.get("authorization"), [process.env.CRON_SECRET]));
  if (!authorize(request)) return response({ status: "unauthorized" }, 401);
  const enabled = deps.enabled ?? (() =>
    process.env.NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED === "true");
  if (!enabled()) return response({ status: "disabled" });
  const now = (deps.now ?? (() => new Date()))();
  const client = deps.client ?? createSupabaseAdminClient();
  const windowStart = new Date(now.getTime() - RESEARCH_WINDOW_MS).toISOString();

  const { data: run, error: runError } = await client.from("research_runs")
    .select("id,scheduled_for,completed_at,status")
    .eq("schedule_slot", slot).eq("status", "completed")
    .gte("scheduled_for", windowStart)
    .order("scheduled_for", { ascending: false })
    .limit(1).maybeSingle<PostResearchRun>();
  if (runError) return response({ status: "failed", reason: "research_read_failed" }, 503);

  const { data: slotRun, error: slotError } = run ? await client.from("research_slot_runs")
    .select("id,research_run_id,slot_key,status,health_state,live_publication_status,hybrid_handoff_status,stage_summary,updated_at")
    .eq("research_run_id", run.id).eq("slot_key", slot)
    .maybeSingle<PostResearchSlotRun>() : { data: null, error: null };
  if (slotError) return response({ status: "failed", reason: "slot_read_failed" }, 503);
  const decision = postResearchEligibility(run, slotRun, now);
  if (!decision.eligible || !run || !slotRun)
    return response({ status: "deferred", reason: decision.reason, slot });

  const claimedAt = now.toISOString();
  const attempt = (decision.previous?.attempt ?? 0) + 1;
  const currentSummary = object(slotRun.stage_summary);
  const claimedCheckpoint: PostResearchCheckpoint = {
    contractVersion: POST_RESEARCH_DOSSIER_V1,
    state: "RUNNING", attempt, claimedAt,
  };
  const claimedSummary = { ...currentSummary, postResearchDossier: claimedCheckpoint };
  // An exact updated_at compare-and-swap is the single owner fence. Overlapping
  // scheduled invocations cannot claim the same completed slot.
  const { data: claimed, error: claimError } = await client.from("research_slot_runs")
    .update({ stage_summary: claimedSummary, updated_at: claimedAt })
    .eq("id", slotRun.id).eq("status", "completed")
    .eq("updated_at", slotRun.updated_at)
    .select("id").maybeSingle<{ id: string }>();
  if (claimError) return response({ status: "failed", reason: "slot_claim_failed" }, 503);
  if (!claimed) return response({ status: "deferred", reason: "slot_claim_race", slot });

  const finish = async (checkpoint: PostResearchCheckpoint) => {
    const { data: updated, error } = await client.from("research_slot_runs")
      .update({
        stage_summary: { ...currentSummary, postResearchDossier: checkpoint },
        updated_at: checkpoint.finishedAt,
      })
      .eq("id", slotRun.id).eq("updated_at", claimedAt)
      .select("id").maybeSingle<{ id: string }>();
    if (error || !updated) throw new Error("Post-research Dossier checkpoint write failed");
  };

  try {
    // A newer canonical Dossier already covers this research completion.
    // Do not regenerate or mutate a published Dossier for a repeat cron.
    const { data: latest, error: latestError } = await client.from("market_dossiers_v2")
      .select("id,as_of").order("as_of", { ascending: false })
      .limit(1).maybeSingle<{ id: string; as_of: string }>();
    if (latestError) throw new Error("Could not inspect the latest canonical Dossier");

    let mode: "PERSISTED" | "NO_CHANGE" | "ALREADY_CURRENT";
    let dossierId: string | null = null;
    let syncState: "synced" | "empty" | "failed" = "empty";
    if (latest && Date.parse(latest.as_of) >= Date.parse(run.completed_at || "")) {
      mode = "ALREADY_CURRENT";
      dossierId = latest.id;
    } else {
      const result = await (deps.run ?? runManualDossierV2)({
        asOf: claimedAt,
        persist: true,
        deltaMode: "auto",
        lookbackHours: 168,
        evidenceLimit: 180,
        // Never pass an injected client to the real authorised persistence path:
        // manual-run intentionally skips its market, SEC and issuer-source
        // acquisition bridges when options.client is present (test isolation).
      });
      if (!result.dossier || !["persisted", "no_change"].includes(result.mode))
        throw new Error("Canonical Dossier returned no persisted/no-change decision");
      mode = result.mode === "persisted" ? "PERSISTED" : "NO_CHANGE";
      dossierId = result.dossier.id;
    }

    // Existing Research Gap materialisation only; never interpret Motion as
    // evidence or create a new Story thesis-version write path.
    try {
      const synced = await (deps.sync ?? syncLatestPrioritisedResearchGapCasesWithD7)(client);
      syncState = synced ? "synced" : "empty";
    } catch (error) {
      // Do not terminalise a slot with unmaterialised Research Gap work.
      // The next bounded retry can reuse the persisted Dossier.
      throw new Error(`Canonical Dossier finished but Research Gap sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    await finish({
      ...claimedCheckpoint, state: "DONE", finishedAt: new Date().toISOString(),
      outcome: mode, dossierId, researchGapSync: syncState,
    });
    console.info(JSON.stringify({ event: "post_research_dossier_completed", slot,
      researchRunId: run.id, dossierId, mode, syncState, attempt }));
    return response({ status: "completed", slot, mode, dossierId,
      researchGapSync: syncState, attempt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Dossier error";
    console.error(JSON.stringify({ event: "post_research_dossier_failed", slot,
      researchRunId: run.id, attempt, reason: message.slice(0, 180) }));
    try {
      await finish({
        ...claimedCheckpoint, state: "FAILED", finishedAt: new Date().toISOString(),
        error: message.slice(0, 180),
      });
    } catch {
      // The initial durable claim remains visible for the next stale-lease
      // retry. Never pretend that failure was checkpointed.
    }
    return response({ status: "failed", slot, reason: "dossier_run_failed", attempt }, 503);
  }
}
