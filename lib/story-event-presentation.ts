import type { Story } from "./data.ts";
import type { StoryEvent, StoryThesisVersion } from "./persistence/contracts.ts";

/**
 * Immutable Story events may only display reasoning from the thesis version
 * actually linked to that event. Never use the Story's latest version as a
 * historical fallback.
 */
export function exactStoryVersionForEvent(
  event: Pick<StoryEvent, "id" | "story_id">,
  versionByEventId: ReadonlyMap<string, StoryThesisVersion>,
): StoryThesisVersion | null {
  const version = versionByEventId.get(event.id);
  return version?.event_id === event.id && version.story_id === event.story_id ? version : null;
}

/**
 * The mutable Story row can be useful for stable identity/slug, but cannot
 * supply later narrative fields to an earlier event's breakdown.
 * Replace all thesis-versioned Story fields with their frozen values,
 * including explicit nulls and empty arrays.
 */
export function historicalStoryView(story: Story, version: StoryThesisVersion): Story {
  if (story.id !== version.story_id) {
    throw new Error("Historical Story/version identity mismatch");
  }
  return {
    ...story,
    title: version.title,
    thesis: version.thesis,
    status: version.status,
    confidence: version.confidence,
    market_question: version.market_question,
    dominant_narrative: version.dominant_narrative,
    best_explanation: version.best_explanation,
    strongest_support: version.strongest_support,
    strongest_contradiction: version.strongest_contradiction,
    priced_assessment: version.priced_assessment,
    confirmation_trigger: version.confirmation_trigger,
    invalidation_trigger: version.invalidation_trigger,
    next_catalyst: version.next_catalyst,
    article_angle: version.article_angle,
    provisional_title: version.provisional_title,
    article_verdict: version.article_verdict,
    assets: version.assets,
  };
}
