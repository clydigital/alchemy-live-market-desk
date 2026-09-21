import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type PersistentStoryForCreatorRouting = {
  id: string;
  slug: string;
  title: string;
  thesis: string;
  status: string;
  confidence: number;
  market_question: string | null;
  dominant_narrative: string | null;
  strongest_support: string | null;
  strongest_contradiction: string | null;
  confirmation_trigger: string | null;
  invalidation_trigger: string | null;
  next_catalyst: string | null;
  assets: string[];
  created_by?: string;
  article_verdict?: string | null;
};

const CREATOR_ROUTING_STORY_FIELDS =
  "id,slug,title,thesis,status,confidence,market_question,dominant_narrative,strongest_support,strongest_contradiction,confirmation_trigger,invalidation_trigger,next_catalyst,assets,created_by,article_verdict";

export async function loadPersistentStoriesForCreatorRouting(
  client: SupabaseClient,
): Promise<PersistentStoryForCreatorRouting[]> {
  const { data, error } = await client
    .from("stories")
    .select(CREATOR_ROUTING_STORY_FIELDS)
    .neq("status", "discarded")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Could not load persistent Stories for creator routing: ${error.message}`);
  return (data ?? []) as PersistentStoryForCreatorRouting[];
}
