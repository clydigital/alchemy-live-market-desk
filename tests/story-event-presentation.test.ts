import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { Story } from "../lib/data.ts";
import type { StoryThesisVersion } from "../lib/persistence/contracts.ts";
import { buildStoryBreakdown } from "../lib/story-breakdown.ts";
import { exactStoryVersionForEvent, historicalStoryView } from "../lib/story-event-presentation.ts";

const story: Story = {
  id: "story-ppi", slug: "cpi-ppi-policy", title: "Latest Treasury-flow Story",
  thesis: "New Treasury flows overwhelmed inflation news.",
  status: "developing", confidence: 75, rank: 1,
  market_question: "Did the producer-price surprise change policy odds?",
  dominant_narrative: null, best_explanation: "Latest Treasury buying explains the yield decline.",
  strongest_support: null, strongest_contradiction: null, priced_assessment: null,
  confirmation_trigger: "Latest 2Y move", invalidation_trigger: "Latest price reversal",
  next_catalyst: "Future rates report", article_angle: null, provisional_title: null,
  article_verdict: null, assets: ["US10Y"], source_quality: 80, novelty: 80,
  persistence: 80, trader_relevance: 80, article_potential: 80,
};

function version(id: string, eventId: string, n: number, explanation: string | null): StoryThesisVersion {
  return {
    id, story_id: story.id, event_id: eventId, version_number: n,
    title: n === 2 ? "PPI supports conditional policy pressure" : "Treasury buying offsets PPI",
    thesis: n === 2 ? "Producer prices raise conditional inflation risk." : story.thesis,
    status: "developing", confidence: 60,
    market_question: story.market_question, dominant_narrative: null,
    best_explanation: explanation, strongest_support: null, strongest_contradiction: null,
    priced_assessment: null, confirmation_trigger: n === 2 ? "Post-PPI FedWatch" : story.confirmation_trigger,
    invalidation_trigger: n === 2 ? "No front-end repricing" : story.invalidation_trigger,
    next_catalyst: null, article_angle: null, provisional_title: null, article_verdict: null,
    assets: n === 2 ? ["US02Y"] : ["US10Y"], portfolio_map: {}, snapshot: {},
    change_reason: "A source-linked thesis revision.", effective_at: "2026-10-15T14:40:53Z",
    created_at: "2026-10-15T14:40:53Z", created_by: null,
  };
}

test("PPI event V2 must retain its own explanation after latest Story advances to V3", () => {
  const v2 = version("version-ppi", "event-ppi", 2, "PPI strengthens conditional policy risk.");
  const v3 = version("version-flow", "event-flow", 3, "Treasury buying explains the latest yield move.");
  const lookup = new Map([[v2.event_id!, v2], [v3.event_id!, v3]]);
  const selected = exactStoryVersionForEvent({ id: "event-ppi", story_id: story.id }, lookup);
  assert.equal(selected?.id, "version-ppi");
  const frozen = historicalStoryView(story, selected!);
  const breakdown = buildStoryBreakdown({ story: frozen, version: selected, event: { headline: "PPI surprised higher" } });
  assert.equal(breakdown.thesisVersionId, "version-ppi");
  assert.equal(breakdown.whyItMatters, "PPI strengthens conditional policy risk.");
  assert.equal(breakdown.currentRead, "Producer prices raise conditional inflation risk.");
  assert.deepEqual(breakdown.affectedMarkets, ["US02Y"]);
  assert.deepEqual(breakdown.confirmation, ["Post-PPI FedWatch"]);
  assert.doesNotMatch(breakdown.whyItMatters, /Treasury buying/);
});

test("No exact event-linked version fails closed instead of borrowing latest Story reasoning", () => {
  const v3 = version("version-flow", "event-flow", 3, story.best_explanation);
  const lookup = new Map([[v3.event_id!, v3]]);
  assert.equal(exactStoryVersionForEvent({ id: "event-ppi", story_id: story.id }, lookup), null);
  assert.equal(exactStoryVersionForEvent({ id: "event-flow", story_id: "unrelated-story" }, lookup), null);
});

test("Frozen null/empty fields never fall back to later Story narrative or signals", () => {
  const v2 = { ...version("version-ppi", "event-ppi", 2, null),
    confirmation_trigger: null, invalidation_trigger: null, assets: [] };
  const frozen = historicalStoryView(story, v2);
  const breakdown = buildStoryBreakdown({ story: frozen, version: v2 });
  assert.equal(breakdown.whyItMatters, v2.thesis);
  assert.deepEqual(breakdown.confirmation, []);
  assert.deepEqual(breakdown.invalidation, []);
  assert.deepEqual(breakdown.affectedMarkets, []);
  assert.throws(() => historicalStoryView({ ...story, id: "other" }, v2), /identity mismatch/);
});

test("What’s New historical and degraded lanes never borrow current Story versions", () => {
  const source = readFileSync(new URL("../app/whats-new/page.tsx", import.meta.url), "utf8");
  const historical = source.split("recordLayer.events.map((event) => {")[1]?.split(": data.updates.map")[0] || "";
  const degraded = source.split(": data.updates.map((update) => {")[1]?.split("  const now = new Date();")[0] || "";
  assert.match(historical, /exactStoryVersionForEvent\(event, versionByEventId\)/);
  assert.match(historical, /version: eventVersion/);
  assert.doesNotMatch(historical, /version: currentVersion/);
  assert.doesNotMatch(degraded, /buildStoryBreakdown|latestVersionByStory|currentVersion/);
  assert.match(degraded, /breakdown: null/);
});
