import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "./supabase/admin.ts";

export type StoryReasoningAction =
  | "queued_review"
  | "waiting_new_evidence"
  | "needs_routing_check"
  | "no_canonical_evidence";

export type StoryReasoningWorkStatus = {
  storyId: string;
  action: StoryReasoningAction;
  pendingReviewCount: number;
  lastEvidenceAt: string | null;
  lastEvaluatedAt: string | null;
};

export function classifyStoryReasoningAction(input: {
  pendingReviewCount: number;
  lastEvidenceAt: string | null;
  lastEvaluatedAt: string | null;
}): StoryReasoningAction {
  if (input.pendingReviewCount > 0) return "queued_review";
  if (!input.lastEvidenceAt) return "no_canonical_evidence";

  const evidenceAt = Date.parse(input.lastEvidenceAt);
  const evaluatedAt = Date.parse(input.lastEvaluatedAt || "");
  if (
    !Number.isFinite(evaluatedAt)
    || (Number.isFinite(evidenceAt) && evidenceAt > evaluatedAt)
  ) {
    return "needs_routing_check";
  }

  return "waiting_new_evidence";
}

export async function getStoryReasoningWorkStatus(
  storyIds: string[],
  client: SupabaseClient = createSupabaseAdminClient(),
) {
  const ids = [...new Set(storyIds.filter(Boolean))];
  if (!ids.length) return new Map<string, StoryReasoningWorkStatus>();

  const [{ data: states, error: stateError }, { data: queue, error: queueError }] = await Promise.all([
    client
      .from("intelligence_story_states")
      .select("story_id,last_evidence_at,last_evaluated_at")
      .in("story_id", ids),
    client
      .from("intelligence_reevaluation_queue")
      .select("target_id,status")
      .eq("target_kind", "story")
      .in("target_id", ids)
      .in("status", ["pending", "retryable", "processing"]),
  ]);

  if (stateError) {
    throw new Error(`Could not load Story reasoning work state: ${stateError.message}`);
  }
  if (queueError) {
    throw new Error(`Could not load Story reasoning queue state: ${queueError.message}`);
  }

  const pendingByStory = new Map<string, number>();
  for (const item of queue ?? []) {
    pendingByStory.set(
      item.target_id,
      (pendingByStory.get(item.target_id) ?? 0) + 1,
    );
  }

  return new Map((states ?? []).map((state) => {
    const pendingReviewCount = pendingByStory.get(state.story_id) ?? 0;
    const status: StoryReasoningWorkStatus = {
      storyId: state.story_id,
      action: classifyStoryReasoningAction({
        pendingReviewCount,
        lastEvidenceAt: state.last_evidence_at,
        lastEvaluatedAt: state.last_evaluated_at,
      }),
      pendingReviewCount,
      lastEvidenceAt: state.last_evidence_at,
      lastEvaluatedAt: state.last_evaluated_at,
    };
    return [state.story_id, status] as const;
  }));
}
