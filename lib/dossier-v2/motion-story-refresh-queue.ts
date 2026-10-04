import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type DossierMotionStoryRefreshRequest,
} from "./motion-story-refresh-request.ts";
import { isValidUuid } from "./validation.ts";

export type DossierMotionStoryRefreshQueueResult = {
  status: "queued" | "empty" | "failed";
  considered: number;
  resolved: number;
  enqueued: number;
  skipped_existing: number;
  rejected: Array<{
    motion_id: string;
    story_id: string;
    reason:
      | "INVALID_ID"
      | "MOTION_NOT_FOUND"
      | "MOTION_STORY_MISMATCH"
      | "MOTION_RUN_MISSING"
      | "ITEM_KEY_MISSING"
      | "CANONICAL_EVIDENCE_NOT_FOUND"
      | "CANONICAL_EVIDENCE_AMBIGUOUS"
      | "STORY_NOT_FOUND"
      | "STORY_DISCARDED";
  }>;
  queue_rows: Array<{
    motion_id: string;
    story_id: string;
    evidence_id: string;
    priority: number;
    reason: string;
  }>;
  error?: string;
};

type MotionRow = {
  id: string;
  research_run_id: string | null;
  primary_story_id: string | null;
  metadata: Record<string, unknown> | null;
};

type EvidenceRow = {
  id: string;
  external_evidence_id: string | null;
  research_run_id: string | null;
  structured_payload: Record<string, unknown> | null;
};

type StoryRow = {
  id: string;
  status: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function strings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(clean).filter(Boolean))];
}

function itemKeys(metadata: Record<string, unknown> | null) {
  return [
    clean(metadata?.itemKey),
    ...strings(metadata?.originItemKeys),
  ].filter(Boolean);
}

function packetEvidenceId(row: EvidenceRow) {
  return clean(row.external_evidence_id) || `ev:${row.id}`;
}

function queuePriority(request: DossierMotionStoryRefreshRequest) {
  const { materiality, relevance, novelty } = request.priority_signals;
  const score =
    60
    + Math.max(0, Math.min(100, materiality)) * 0.18
    + Math.max(0, Math.min(100, relevance)) * 0.10
    + Math.max(0, Math.min(100, novelty)) * 0.04;
  return Math.max(70, Math.min(95, Math.round(score)));
}

function queueReason(request: DossierMotionStoryRefreshRequest) {
  return `dossier_motion_refresh:${request.dossier_id}:${request.motion_id}:${request.decision}`;
}

export async function enqueueDossierMotionStoryRefreshRequests(input: {
  client: SupabaseClient;
  requests: DossierMotionStoryRefreshRequest[];
  availableAt: string;
}): Promise<DossierMotionStoryRefreshQueueResult> {
  const requests = input.requests.slice(0, 4);
  if (!requests.length) {
    return {
      status: "empty",
      considered: 0,
      resolved: 0,
      enqueued: 0,
      skipped_existing: 0,
      rejected: [],
      queue_rows: [],
    };
  }

  try {
    const rejected: DossierMotionStoryRefreshQueueResult["rejected"] = [];
    const structurallyValid = requests.filter((request) => {
      if (!isValidUuid(request.motion_id) || !isValidUuid(request.story_id)) {
        rejected.push({
          motion_id: request.motion_id,
          story_id: request.story_id,
          reason: "INVALID_ID",
        });
        return false;
      }
      return true;
    });

    if (!structurallyValid.length) {
      return {
        status: "empty",
        considered: requests.length,
        resolved: 0,
        enqueued: 0,
        skipped_existing: 0,
        rejected,
        queue_rows: [],
      };
    }

    const motionIds = [...new Set(structurallyValid.map((request) => request.motion_id))];
    const { data: motionData, error: motionError } = await input.client
      .from("market_motion_items")
      .select("id,research_run_id,primary_story_id,metadata")
      .in("id", motionIds);

    if (motionError) throw new Error(`Failed to load exact Motion rows for Story refresh: ${motionError.message}`);

    const motions = (motionData ?? []) as MotionRow[];
    const motionById = new Map(motions.map((row) => [row.id, row] as const));
    const runIds = [...new Set(
      motions
        .map((row) => row.research_run_id)
        .filter((value): value is string => Boolean(value)),
    )];

    let evidenceRows: EvidenceRow[] = [];
    if (runIds.length) {
      const { data, error } = await input.client
        .from("intelligence_evidence")
        .select("id,external_evidence_id,research_run_id,structured_payload")
        .in("research_run_id", runIds)
        .limit(600);

      if (error) throw new Error(`Failed to resolve Motion Story refresh evidence: ${error.message}`);
      evidenceRows = (data ?? []) as EvidenceRow[];
    }

    const evidenceByRunAndItem = new Map<string, EvidenceRow[]>();
    for (const row of evidenceRows) {
      const runId = clean(row.research_run_id);
      const itemKey = clean(row.structured_payload?.itemKey);
      if (!runId || !itemKey || !isValidUuid(row.id)) continue;
      const key = `${runId}:${itemKey}`;
      const rows = evidenceByRunAndItem.get(key) ?? [];
      rows.push(row);
      evidenceByRunAndItem.set(key, rows);
    }

    const storyIds = [...new Set(structurallyValid.map((request) => request.story_id))];
    const { data: storyData, error: storyError } = await input.client
      .from("stories")
      .select("id,status")
      .in("id", storyIds);

    if (storyError) throw new Error(`Failed to validate exact Story refresh targets: ${storyError.message}`);
    const storyById = new Map(
      ((storyData ?? []) as StoryRow[]).map((row) => [row.id, row] as const),
    );

    const resolved: Array<{
      request: DossierMotionStoryRefreshRequest;
      evidenceId: string;
      priority: number;
      reason: string;
    }> = [];

    for (const request of structurallyValid) {
      const motion = motionById.get(request.motion_id);
      if (!motion) {
        rejected.push({ motion_id: request.motion_id, story_id: request.story_id, reason: "MOTION_NOT_FOUND" });
        continue;
      }
      if (motion.primary_story_id !== request.story_id) {
        rejected.push({ motion_id: request.motion_id, story_id: request.story_id, reason: "MOTION_STORY_MISMATCH" });
        continue;
      }

      const runId = clean(motion.research_run_id);
      if (!runId) {
        rejected.push({ motion_id: request.motion_id, story_id: request.story_id, reason: "MOTION_RUN_MISSING" });
        continue;
      }

      const keys = itemKeys(motion.metadata);
      if (!keys.length) {
        rejected.push({ motion_id: request.motion_id, story_id: request.story_id, reason: "ITEM_KEY_MISSING" });
        continue;
      }

      const canonicalMatches = [
        ...new Map(
          keys.flatMap((itemKey) => evidenceByRunAndItem.get(`${runId}:${itemKey}`) ?? [])
            .filter((row) => packetEvidenceId(row) === request.packet_evidence_id)
            .map((row) => [row.id, row] as const),
        ).values(),
      ];

      if (!canonicalMatches.length) {
        rejected.push({ motion_id: request.motion_id, story_id: request.story_id, reason: "CANONICAL_EVIDENCE_NOT_FOUND" });
        continue;
      }
      if (canonicalMatches.length !== 1) {
        rejected.push({ motion_id: request.motion_id, story_id: request.story_id, reason: "CANONICAL_EVIDENCE_AMBIGUOUS" });
        continue;
      }

      const story = storyById.get(request.story_id);
      if (!story) {
        rejected.push({ motion_id: request.motion_id, story_id: request.story_id, reason: "STORY_NOT_FOUND" });
        continue;
      }
      if (story.status === "discarded") {
        rejected.push({ motion_id: request.motion_id, story_id: request.story_id, reason: "STORY_DISCARDED" });
        continue;
      }

      resolved.push({
        request,
        evidenceId: canonicalMatches[0]!.id,
        priority: queuePriority(request),
        reason: queueReason(request),
      });
    }

    if (!resolved.length) {
      return {
        status: "empty",
        considered: requests.length,
        resolved: 0,
        enqueued: 0,
        skipped_existing: 0,
        rejected,
        queue_rows: [],
      };
    }

    const resolvedStoryIds = [...new Set(resolved.map((item) => item.request.story_id))];
    const resolvedEvidenceIds = [...new Set(resolved.map((item) => item.evidenceId))];
    const { data: existingData, error: existingError } = await input.client
      .from("intelligence_reevaluation_queue")
      .select("target_id,requested_by_evidence_id,status")
      .eq("target_kind", "story")
      .in("target_id", resolvedStoryIds)
      .in("requested_by_evidence_id", resolvedEvidenceIds)
      .in("status", ["pending", "processing", "retryable"]);

    if (existingError) throw new Error(`Failed to inspect exact Story refresh queue: ${existingError.message}`);

    const existing = new Set(
      (existingData ?? []).map((row) =>
        `${String(row.target_id)}:${String(row.requested_by_evidence_id)}`,
      ),
    );
    const missing = resolved.filter((item) =>
      !existing.has(`${item.request.story_id}:${item.evidenceId}`),
    );

    if (missing.length) {
      const { error: insertError } = await input.client
        .from("intelligence_reevaluation_queue")
        .insert(missing.map((item) => ({
          target_kind: "story",
          target_id: item.request.story_id,
          requested_by_evidence_id: item.evidenceId,
          reason: item.reason,
          priority: item.priority,
          status: "pending",
          available_at: input.availableAt,
        })));

      if (insertError) throw new Error(`Failed to enqueue exact Dossier Motion Story refresh: ${insertError.message}`);
    }

    return {
      status: "queued",
      considered: requests.length,
      resolved: resolved.length,
      enqueued: missing.length,
      skipped_existing: resolved.length - missing.length,
      rejected,
      queue_rows: resolved.map((item) => ({
        motion_id: item.request.motion_id,
        story_id: item.request.story_id,
        evidence_id: item.evidenceId,
        priority: item.priority,
        reason: item.reason,
      })),
    };
  } catch (error) {
    return {
      status: "failed",
      considered: requests.length,
      resolved: 0,
      enqueued: 0,
      skipped_existing: 0,
      rejected: [],
      queue_rows: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
