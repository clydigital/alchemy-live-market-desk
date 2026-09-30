import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadPrioritisedResearchGapWork,
  type PrioritisedResearchGap,
  type ResearchGapPriorityQueue,
} from "./research-gap-prioritizer.ts";
import { createSupabaseAdminClient } from "./supabase/admin.ts";

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

function snapshot(item: PrioritisedResearchGap) {
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
  };
}

async function syncOne(
  item: PrioritisedResearchGap,
  client: SupabaseClient,
  observedAt: string,
) {
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
    p_evidence_needed: item.evidenceNeeded,
    p_linked_investigation_ids: item.linkedInvestigationIds,
    p_linked_story_ids: item.linkedStoryIds,
    p_blocking_refs: item.blockingRefs,
    p_priority_rank: item.priorityRank,
    p_priority_score: item.priorityScore,
    p_snapshot: snapshot(item),
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

export async function listResearchGapCases(
  client: SupabaseClient = createSupabaseAdminClient(),
  limit = 50,
) {
  const { data, error } = await client
    .from("research_gap_cases")
    .select("id,gap_key,status,research_outcome,source_kind,source_ref,question,action,reason,evidence_needed,linked_investigation_ids,linked_story_ids,blocking_refs,latest_work_id,latest_dossier_id,latest_dossier_as_of,latest_priority_rank,latest_priority_score,first_seen_at,last_seen_at,occurrence_count,claim_token,claimed_by,claimed_at,claim_expires_at,attempt_count,completed_at,handed_off_at,closed_at,created_at,updated_at")
    .neq("status", "CLOSED")
    .order("latest_priority_score", { ascending: false, nullsFirst: false })
    .order("first_seen_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 100)));

  message(error, "Could not list Research Gap cases");
  return (data ?? []) as ResearchGapCaseRow[];
}
