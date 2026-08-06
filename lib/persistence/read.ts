import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StoryEvent, StoryThesisVersion } from "@/lib/persistence/contracts";

export type StoryRecordLayer = {
  available: boolean;
  events: StoryEvent[];
  thesisVersions: StoryThesisVersion[];
};

const EMPTY_LAYER: StoryRecordLayer = {
  available: false,
  events: [],
  thesisVersions: [],
};

function isMissingRelation(message: string | undefined) {
  return Boolean(message && /does not exist|schema cache|could not find the table|relation/i.test(message));
}

export async function getStoryRecordLayer(): Promise<StoryRecordLayer> {
  try {
    const supabase = await createSupabaseServerClient();
    const [eventsResult, versionsResult] = await Promise.all([
      supabase
        .from("story_events")
        .select("*")
        .order("event_at", { ascending: false })
        .limit(500),
      supabase
        .from("story_thesis_versions")
        .select("*")
        .order("version_number", { ascending: false })
        .limit(250),
    ]);

    if (eventsResult.error || versionsResult.error) {
      const expectedUnavailable = isMissingRelation(eventsResult.error?.message) || isMissingRelation(versionsResult.error?.message);
      if (!expectedUnavailable) {
        console.warn("Story record layer unavailable", {
          events: eventsResult.error?.message,
          versions: versionsResult.error?.message,
        });
      }
      return EMPTY_LAYER;
    }

    return {
      available: true,
      events: (eventsResult.data || []) as StoryEvent[],
      thesisVersions: (versionsResult.data || []) as StoryThesisVersion[],
    };
  } catch {
    return EMPTY_LAYER;
  }
}
