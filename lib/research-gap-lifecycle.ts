import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadPrioritisedResearchGapWork,
  type PrioritisedResearchGap,
  type ResearchGapPriorityQueue,
} from "./research-gap-prioritizer.ts";
import { createSupabaseAdminClient } from "./supabase/admin.ts";
import {
  decideResearchGapDiscriminatorLifecycle,
  researchGapDiscriminatorLifecycleFromPlan,
  selectResearchGapDiscriminatorLifecycleSource,
  type ResearchGapDiscriminatorLifecycleSnapshot,
} from "./research-gap-discriminator-lifecycle.ts";

export const RESEARCH_GAP_CASE_STATUSES = [
  "NEW",
  "QUEUED",
  "CLAIMED",
  "RESEARCHING",
  "COMPLETED",
  "HANDED_OFF",
  "CLOSED",
] as const;

export const RESEARCH_GAP_OUTCOMES = [
  "CONFIRMING",
  "CONTRADICTING",
  "UNRESOLVED",
  "NO_CHANGE",
] as const;

export type ResearchGapCaseStatus = typeof RESEARCH_GAP_CASE_STATUSES[number];
export type ResearchGapOutcome = typeof RESEARCH_GAP_OUTCOMES[number];

export type ResearchGapCaseRow = {
  id: string;
  gap_key: string;
  status: ResearchGapCaseStatus;
  research_outcome: ResearchGapOutcome | null;
  source_kind: PrioritisedResearchGap["sourceKind"];
  source_ref: string;
  question: string | null;
  action: string;
  reason: string | null;
  evidence_needed: string[];
  linked_investigation_ids: string[];
  linked_story_ids: string[];
  blocking_refs: string[];
  latest_work_id: string;
  latest_dossier_id: string;
  latest_dossier_as_of: string;
  latest_priority_rank: number | null;
  latest_priority_score: number | null;
  first_seen_at: string;
  last_seen_at: string;
  occurrence_count: number;
  claim_token: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  claim_expires_at: string | null;
  attempt_count: number;
  completed_at: string | null;
  handed_off_at: string | null;
  closed_at: string | null;
  research_plan_version: string | null;
  research_plan: Record<string, unknown> | null;
  research_started_at: string | null;
  verdict_version: string | null;
  verdict: Record<string, unknown> | null;
  handoff_run_key: string | null;
  handoff_canonical_status: number | null;
  created_at: string;
  updated_at: string;
};

export type ClaimedResearchGapCase = ResearchGapCaseRow & {
  claim_token: string;
  claimed_by: string;
  claimed_at: string;
  claim_expires_at: string;
};

function message(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function snapshot(
  item: PrioritisedResearchGap,
  causalDiscriminator?: ResearchGapDiscriminatorLifecycleSnapshot | null,
) {
  return {
    contractVersion: "research-gap-case-snapshot/1",
    workId: item.workId,
    gapKey: item.gapKey,
    sourceKind: item.sourceKind,
    sourceRef: item.sourceRef,
    question: item.question,
    action: item.action,
    reason: item.reason,
    evidenceNeeded: item.evidenceNeeded,
    linkedInvestigationIds: item.linkedInvestigationIds,
    linkedStoryIds: item.linkedStoryIds,
    blockingRefs: item.blockingRefs,
    nativeSignals: item.nativeSignals,
    priorityRank: item.priorityRank,
    priorityScore: item.priorityScore,
    scoreBreakdown: item.scoreBreakdown,
    selectionReason: item.selectionReason,
    ...(causalDiscriminator ? { causalDiscriminator } : {}),
  };
}

async function loadResearchGapCaseByGapKey(
  gapKey: string,
  client: SupabaseClient,
) {
  const { data, error } = await client
    .from("research_gap_cases")
    .select("id,gap_key,status,research_outcome,source_kind,source_ref,question,action,reason,evidence_needed,linked_investigation_ids,linked_story_ids,blocking_refs,latest_work_id,latest_dossier_id,latest_dossier_as_of,latest_priority_rank,latest_priority_score,first_seen_at,last_seen_at,occurrence_count,claim_token,claimed_by,claimed_at,claim_expires_at,attempt_count,completed_at,handed_off_at,closed_at,research_plan_version,research_plan,research_started_at,verdict_version,verdict,handoff_run_key,handoff_canonical_status,created_at,updated_at")
    .eq("gap_key", gapKey)
    .maybeSingle();
  message(error, `Could not load Research Gap case ${gapKey}`);
  return (data || null) as ResearchGapCaseRow | null;
}

async function loadRecentResearchGapOccurrenceSnapshots(
  caseId: string,
  client: SupabaseClient,
) {
  const { data, error } = await client
    .from("research_gap_case_occurrences")
    .select("snapshot")
    .eq("gap_case_id", caseId)
    .order("observed_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  message(error, `Could not load recent Research Gap occurrences ${caseId}`);
  return (data ?? []).map((row) => row.snapshot);
}

export async function hasCanonicalResearchGapHandoff(
  caseId: string,
  client: SupabaseClient = createSupabaseAdminClient(),
) {
  const { data, error } = await client
    .from("intelligence_evidence")
    .select("id")
    .contains("structured_payload", {
      researchGapHandoff: { gapId: caseId },
    })
    .limit(1)
    .maybeSingle();
  message(error, `Could not verify canonical Research Gap handoff ${caseId}`);
  return Boolean(data);
}

async function transitionResearchGapCase(
  input: {
    caseId: string;
    expectedStatus: "HANDED_OFF" | "CLOSED";
    action: "REQUEUE" | "CLOSE";
    at: string;
  },
  client: SupabaseClient,
) {
  const patch = input.action === "REQUEUE"
    ? {
        status: "QUEUED",
        research_outcome: null,
        claim_token: null,
        claimed_by: null,
        claimed_at: null,
        claim_expires_at: null,
        completed_at: null,
        handed_off_at: null,
        closed_at: null,
        research_plan_version: null,
        research_plan: null,
        research_started_at: null,
        verdict_version: null,
        verdict: null,
        handoff_run_key: null,
        handoff_canonical_status: null,
        updated_at: input.at,
      }
    : {
        status: "CLOSED",
        claim_token: null,
        claimed_by: null,
        claimed_at: null,
        claim_expires_at: null,
        closed_at: input.at,
        updated_at: input.at,
      };

  const { data, error } = await client
    .from("research_gap_cases")
    .update(patch)
    .eq("id", input.caseId)
    .eq("status", input.expectedStatus)
    .select("id,status")
    .maybeSingle();
  message(error, `Could not ${input.action.toLowerCase()} Research Gap discriminator case ${input.caseId}`);
  return Boolean(data);
}

async function syncOne(
  item: PrioritisedResearchGap,
  client: SupabaseClient,
  observedAt: string,
) {
  let evidenceNeeded = item.evidenceNeeded;
  let causalDiscriminator: ResearchGapDiscriminatorLifecycleSnapshot | null = null;

  if (item.causalDiscriminatorPlan) {
    const existing = await loadResearchGapCaseByGapKey(item.gapKey, client);
    const needsOccurrenceFallback = Boolean(
      existing
      && !researchGapDiscriminatorLifecycleFromPlan(existing.research_plan),
    );
    const occurrenceSnapshots = needsOccurrenceFallback && existing
      ? await loadRecentResearchGapOccurrenceSnapshots(existing.id, client)
      : [];
    const existingLifecycleSource = selectResearchGapDiscriminatorLifecycleSource({
      existingResearchPlan: existing?.research_plan ?? null,
      occurrenceSnapshots,
    });
    const canonicalHandoffAdmitted = existing?.status === "HANDED_OFF"
      ? await hasCanonicalResearchGapHandoff(existing.id, client)
      : false;
    const discriminatorDecision = decideResearchGapDiscriminatorLifecycle({
      candidatePlan: item.causalDiscriminatorPlan,
      existingStatus: existing?.status ?? null,
      existingResearchPlan: existingLifecycleSource,
      canonicalHandoffAdmitted,
    });
    evidenceNeeded = discriminatorDecision.evidenceNeeded;
    causalDiscriminator = discriminatorDecision.lifecycle;

    if (existing && discriminatorDecision.shouldRequeue) {
      const expectedStatus = existing.status === "CLOSED" ? "CLOSED" : "HANDED_OFF";
      const requeued = await transitionResearchGapCase({
        caseId: existing.id,
        expectedStatus,
        action: "REQUEUE",
        at: observedAt,
      }, client);
      if (!requeued) {
        throw new Error(`Research Gap discriminator case ${existing.id} changed state before requeue.`);
      }
    } else if (existing && discriminatorDecision.shouldClose && existing.status === "HANDED_OFF") {
      const closed = await transitionResearchGapCase({
        caseId: existing.id,
        expectedStatus: "HANDED_OFF",
        action: "CLOSE",
        at: observedAt,
      }, client);
      if (!closed) {
        throw new Error(`Research Gap discriminator case ${existing.id} changed state before close.`);
      }
    }
  }

  const { data, error } = await client.rpc("upsert_research_gap_case", {
    p_gap_key: item.gapKey,
    p_dossier_id: item.dossierId,
    p_dossier_as_of: item.dossierAsOf,
    p_work_id: item.workId,
    p_source_kind: item.sourceKind,
    p_source_ref: item.sourceRef,
    p_question: item.question,
    p_action: item.action,
    p_reason: item.reason,
    p_evidence_needed: evidenceNeeded,
    p_linked_investigation_ids: item.linkedInvestigationIds,
    p_linked_story_ids: item.linkedStoryIds,
    p_blocking_refs: item.blockingRefs,
    p_priority_rank: item.priorityRank,
    p_priority_score: item.priorityScore,
    p_snapshot: snapshot({ ...item, evidenceNeeded }, causalDiscriminator),
    p_observed_at: observedAt,
  });
  message(error, `Could not persist Research Gap case ${item.gapKey}`);
  const rows = (data ?? []) as ResearchGapCaseRow[];
  if (!rows[0]) throw new Error(`Research Gap case ${item.gapKey} was not returned after sync.`);
  return rows[0];
}

export async function syncResearchGapPriorityQueue(
  queue: ResearchGapPriorityQueue,
  client: SupabaseClient,
  now = new Date(),
) {
  const observedAt = now.toISOString();
  const cases: ResearchGapCaseRow[] = [];

  // The priority queue is capped at three. Keep the writes sequential so a
  // replay cannot create confusing concurrent updates for the same stable key.
  for (const item of queue.selected) {
    cases.push(await syncOne(item, client, observedAt));
  }

  return {
    contractVersion: "research-gap-lifecycle-sync/1" as const,
    dossierId: queue.dossierId,
    dossierAsOf: queue.dossierAsOf,
    syncedAt: observedAt,
    selectedCount: queue.selected.length,
    cases,
  };
}

export async function syncLatestPrioritisedResearchGapCases(
  client: SupabaseClient = createSupabaseAdminClient(),
  now = new Date(),
) {
  const queue = await loadPrioritisedResearchGapWork(client, now);
  if (!queue) return null;
  return syncResearchGapPriorityQueue(queue, client, now);
}

export async function claimResearchGapCases(
  input: { workerId: string; batchSize?: number; leaseSeconds?: number },
  client: SupabaseClient = createSupabaseAdminClient(),
) {
  const workerId = input.workerId.trim();
  if (!workerId) throw new Error("workerId is required.");

  const { data, error } = await client.rpc("claim_research_gap_cases", {
    p_worker_id: workerId,
    p_batch_size: Math.max(1, Math.min(input.batchSize ?? 1, 3)),
    p_lease_seconds: Math.max(60, Math.min(input.leaseSeconds ?? 600, 1800)),
  });
  message(error, "Could not atomically claim Research Gap cases");

  return (data ?? []) as ClaimedResearchGapCase[];
}

export async function releaseResearchGapCase(
  input: { caseId: string; claimToken: string },
  client: SupabaseClient = createSupabaseAdminClient(),
) {
  const { data, error } = await client.rpc("release_research_gap_case", {
    p_case_id: input.caseId,
    p_claim_token: input.claimToken,
  });
  message(error, "Could not release Research Gap case");
  return data === true;
}

export async function getOwnedResearchGapCase(
  input: { caseId: string; claimToken: string; statuses?: ResearchGapCaseStatus[] },
  client: SupabaseClient = createSupabaseAdminClient(),
) {
  let query = client
    .from("research_gap_cases")
    .select("id,gap_key,status,research_outcome,source_kind,source_ref,question,action,reason,evidence_needed,linked_investigation_ids,linked_story_ids,blocking_refs,latest_work_id,latest_dossier_id,latest_dossier_as_of,latest_priority_rank,latest_priority_score,first_seen_at,last_seen_at,occurrence_count,claim_token,claimed_by,claimed_at,claim_expires_at,attempt_count,completed_at,handed_off_at,closed_at,research_plan_version,research_plan,research_started_at,verdict_version,verdict,handoff_run_key,handoff_canonical_status,created_at,updated_at")
    .eq("id", input.caseId)
    .eq("claim_token", input.claimToken);

  const statuses = input.statuses?.filter(Boolean) || [];
  if (statuses.length === 1) query = query.eq("status", statuses[0]!);
  else if (statuses.length > 1) query = query.in("status", statuses);

  const { data, error } = await query.maybeSingle();
  message(error, "Could not load owned Research Gap case");
  return (data || null) as ResearchGapCaseRow | null;
}

export async function startResearchGapCase(
  input: {
    caseId: string;
    claimToken: string;
    planVersion: string;
    plan: Record<string, unknown>;
    startedAt?: string;
  },
  client: SupabaseClient = createSupabaseAdminClient(),
) {
  const { data, error } = await client.rpc("start_research_gap_case", {
    p_case_id: input.caseId,
    p_claim_token: input.claimToken,
    p_plan_version: input.planVersion,
    p_plan: input.plan,
    p_started_at: input.startedAt || new Date().toISOString(),
  });
  message(error, "Could not start Research Gap case");
  const rows = (data ?? []) as ResearchGapCaseRow[];
  return rows[0] || null;
}

export async function completeResearchGapCase(
  input: {
    caseId: string;
    claimToken: string;
    outcome: ResearchGapOutcome;
    verdictVersion: string;
    verdict: Record<string, unknown>;
    completedAt?: string;
  },
  client: SupabaseClient = createSupabaseAdminClient(),
) {
  const { data, error } = await client.rpc("complete_research_gap_case", {
    p_case_id: input.caseId,
    p_claim_token: input.claimToken,
    p_outcome: input.outcome,
    p_verdict_version: input.verdictVersion,
    p_verdict: input.verdict,
    p_completed_at: input.completedAt || new Date().toISOString(),
  });
  message(error, "Could not complete Research Gap case");
  const rows = (data ?? []) as ResearchGapCaseRow[];
  return rows[0] || null;
}

export async function closeSupersededCompletedD7ResearchGapCase(
  input: {
    caseId: string;
    sourceRef: string;
    closedAt?: string;
  },
  client: SupabaseClient = createSupabaseAdminClient(),
) {
  const sourceRef = input.sourceRef.trim();
  if (!sourceRef.startsWith("d7:")) {
    throw new Error("Only D7 Research Gap cases may be closed as superseded by current D7 state.");
  }

  const closedAt = input.closedAt || new Date().toISOString();
  const { data, error } = await client
    .from("research_gap_cases")
    .update({
      status: "CLOSED",
      claim_token: null,
      claimed_by: null,
      claimed_at: null,
      claim_expires_at: null,
      closed_at: closedAt,
      updated_at: closedAt,
    })
    .eq("id", input.caseId)
    .eq("status", "COMPLETED")
    .eq("source_kind", "research_gap")
    .eq("source_ref", sourceRef)
    .is("handed_off_at", null)
    .is("handoff_run_key", null)
    .select("id,gap_key,status,research_outcome,source_kind,source_ref,question,action,reason,evidence_needed,linked_investigation_ids,linked_story_ids,blocking_refs,latest_work_id,latest_dossier_id,latest_dossier_as_of,latest_priority_rank,latest_priority_score,first_seen_at,last_seen_at,occurrence_count,claim_token,claimed_by,claimed_at,claim_expires_at,attempt_count,completed_at,handed_off_at,closed_at,research_plan_version,research_plan,research_started_at,verdict_version,verdict,handoff_run_key,handoff_canonical_status,created_at,updated_at")
    .maybeSingle();
  message(error, "Could not close superseded completed D7 Research Gap case");
  return (data || null) as ResearchGapCaseRow | null;
}

export async function getResearchGapCaseById(
  caseId: string,
  client: SupabaseClient = createSupabaseAdminClient(),
) {
  const { data, error } = await client
    .from("research_gap_cases")
    .select("id,gap_key,status,research_outcome,source_kind,source_ref,question,action,reason,evidence_needed,linked_investigation_ids,linked_story_ids,blocking_refs,latest_work_id,latest_dossier_id,latest_dossier_as_of,latest_priority_rank,latest_priority_score,first_seen_at,last_seen_at,occurrence_count,claim_token,claimed_by,claimed_at,claim_expires_at,attempt_count,completed_at,handed_off_at,closed_at,research_plan_version,research_plan,research_started_at,verdict_version,verdict,handoff_run_key,handoff_canonical_status,created_at,updated_at")
    .eq("id", caseId)
    .maybeSingle();
  message(error, "Could not load Research Gap case");
  return (data || null) as ResearchGapCaseRow | null;
}

export async function markResearchGapCaseHandedOff(
  input: {
    caseId: string;
    outcome: ResearchGapOutcome;
    runKey: string;
    canonicalStatus: number;
    handedOffAt?: string;
  },
  client: SupabaseClient = createSupabaseAdminClient(),
) {
  const { data, error } = await client.rpc("mark_research_gap_case_handed_off", {
    p_case_id: input.caseId,
    p_expected_outcome: input.outcome,
    p_handoff_run_key: input.runKey,
    p_canonical_status: input.canonicalStatus,
    p_handed_off_at: input.handedOffAt || new Date().toISOString(),
  });
  message(error, "Could not mark Research Gap case handed off");
  const rows = (data ?? []) as ResearchGapCaseRow[];
  return rows[0] || null;
}

export async function listResearchGapCases(
  client: SupabaseClient = createSupabaseAdminClient(),
  limit = 50,
) {
  const { data, error } = await client
    .from("research_gap_cases")
    .select("id,gap_key,status,research_outcome,source_kind,source_ref,question,action,reason,evidence_needed,linked_investigation_ids,linked_story_ids,blocking_refs,latest_work_id,latest_dossier_id,latest_dossier_as_of,latest_priority_rank,latest_priority_score,first_seen_at,last_seen_at,occurrence_count,claim_token,claimed_by,claimed_at,claim_expires_at,attempt_count,completed_at,handed_off_at,closed_at,research_plan_version,research_plan,research_started_at,verdict_version,verdict,handoff_run_key,handoff_canonical_status,created_at,updated_at")
    .neq("status", "CLOSED")
    .order("latest_priority_score", { ascending: false, nullsFirst: false })
    .order("first_seen_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 100)));

  message(error, "Could not list Research Gap cases");
  return (data ?? []) as ResearchGapCaseRow[];
}
