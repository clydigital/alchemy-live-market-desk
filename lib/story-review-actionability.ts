import "server-only";

import { createSupabaseAdminClient } from "./supabase/admin.ts";

export type StoryReviewQueueState = {
  storyId: string;
  pendingReviewCount: number;
  lastEvidenceAt: string | null;
  lastEvaluatedAt: string | null;
};

function timestamp(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? value
    : null;
}

export function storyHasFreshUnreviewedEvidence(input: {
  lastEvidenceAt: string | null;
  lastEvaluatedAt: string | null;
}) {
  if (!input.lastEvidenceAt) return false;
  if (!input.lastEvaluatedAt) return true;
  return Date.parse(input.lastEvidenceAt) > Date.parse(input.lastEvaluatedAt);
}

export async function getStoryReviewQueueState(
  storyIds: string[],
): Promise<StoryReviewQueueState[]> {
  const ids = [...new Set(storyIds.filter(Boolean))];
  if (!ids.length) return [];

  try {
    const client = createSupabaseAdminClient();
    const [stateResult, queueResult] = await Promise.all([
      client
        .from("intelligence_story_states")
        .select("story_id,last_evidence_at,last_evaluated_at")
        .in("story_id", ids),
      client
        .from("intelligence_reevaluation_queue")
        .select("target_id,status")
        .eq("target_kind", "story")
        .eq("status", "pending")
        .in("target_id", ids),
    ]);

    if (stateResult.error || queueResult.error) return [];

    const pending = new Map<string, number>();
    for (const row of queueResult.data ?? []) {
      if (typeof row.target_id !== "string") continue;
      pending.set(row.target_id, (pending.get(row.target_id) ?? 0) + 1);
    }

    const stateByStory = new Map(
      (stateResult.data ?? []).map((row) => [row.story_id, row] as const),
    );

    return ids.map((storyId) => {
      const row = stateByStory.get(storyId);
      return {
        storyId,
        pendingReviewCount: pending.get(storyId) ?? 0,
        lastEvidenceAt: timestamp(row?.last_evidence_at),
        lastEvaluatedAt: timestamp(row?.last_evaluated_at),
      };
    });
  } catch {
    return [];
  }
}
