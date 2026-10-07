import type { SupabaseClient } from "@supabase/supabase-js";

import type { D7StoryReviewClock } from "./dossier-v2/cross-layer-divergence.ts";
import { createSupabaseAdminClient } from "./supabase/admin.ts";

export async function getD7StoryReviewClocks(
  storyIds: string[],
  client: SupabaseClient = createSupabaseAdminClient(),
): Promise<D7StoryReviewClock[]> {
  const ids = [...new Set(storyIds.filter(Boolean))];
  if (!ids.length) return [];

  const { data, error } = await client
    .from("intelligence_story_states")
    .select("story_id,last_evaluated_at")
    .in("story_id", ids);

  if (error) {
    throw new Error(`Could not load D7 Story review clocks: ${error.message}`);
  }

  const byStory = new Map(
    (data ?? []).map((item) => [item.story_id, item.last_evaluated_at] as const),
  );

  return ids.map((storyId) => {
    const evaluatedAt = byStory.get(storyId);
    return {
      storyId,
      evaluatedAt: typeof evaluatedAt === "string" ? evaluatedAt : null,
      basis: typeof evaluatedAt === "string" ? "story_review" : "unavailable",
    };
  });
}
