import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCanonicalEditionIndex,
  buildCanonicalEditionResponseContract,
  replayImmutableEdition,
  selectCanonicalEdition,
  type EditionSnapshot,
} from "../lib/edition-replay.ts";

function daily(id: string, publishedAt: string, payload: Record<string, unknown> = {}, supersedes: string | null = null): EditionSnapshot {
  return {
    id,
    research_run_id: `run-${id}`,
    supersedes_snapshot_id: supersedes,
    snapshot_type: "daily_brief",
    payload,
    published_at: publishedAt,
  };
}

test("current edition response metadata is derived from the terminal canonical edition", () => {
  const snapshots = [
    daily("morning", "2026-08-16T01:15:00.000Z", { scheduleSlot: "morning", scheduledFor: "2026-08-16T01:15:00.000Z", runKey: "cron:morning" }),
    daily("evening", "2026-08-16T13:15:00.000Z", { scheduleSlot: "evening", scheduledFor: "2026-08-16T13:15:00.000Z" }),
  ];
  const index = buildCanonicalEditionIndex(snapshots, [{ id: "run-evening", run_key: "cron:evening" }]);

  assert.equal(index[0]?.snapshotId, "evening");
  assert.equal(index[0]?.freshness, "current");
  assert.equal(index[0]?.slot, "evening");
  assert.equal(index[0]?.scheduledFor, "2026-08-16T13:15:00.000Z");
  assert.equal(index[0]?.runKey, "cron:evening");
  assert.deepEqual(selectCanonicalEdition(index, null), { current: index[0], selected: index[0], status: "current" });
});

test("historical edition replays its exact immutable persisted Story state", () => {
  const snapshot = daily("historical", "2026-08-15T01:15:00.000Z", {
    canonicalStoryManifest: [
      { position: 2, snapshotId: "story-b", storyId: "b", state: { id: "b", title: "Historical B", thesis: "then", featuredRank: null } },
      { position: 1, snapshotId: "story-a", storyId: "a", state: { id: "a", title: "Historical A", thesis: "then", featuredRank: 1 } },
    ],
  });

  const replay = replayImmutableEdition(snapshot, []);
  assert.equal(replay.limitation, null);
  assert.deepEqual(replay.storyStates.map((story) => story.title), ["Historical A", "Historical B"]);
  assert.equal(replay.featuredStoryStates[0]?.id, "a");
});

test("historical membership remains immutable after current Story tables change", () => {
  const snapshot = daily("historical", "2026-08-15T01:15:00.000Z", {
    canonicalStoryManifest: [
      { position: 1, snapshotId: "story-a", storyId: "a", state: { id: "a", title: "Original title", thesis: "original", featuredRank: 1 } },
    ],
  });
  const currentStories = [{ id: "a", title: "Changed today" }, { id: "new", title: "New today" }];
  const replay = replayImmutableEdition(snapshot, []);

  assert.equal(replay.storyStates[0]?.title, "Original title");
  assert.equal(replay.storyStates.some((story) => story.id === currentStories[1]?.id), false);
});

test("superseded retry snapshots are removed deterministically from the edition index", () => {
  const snapshots = [
    daily("retry-1", "2026-08-16T01:15:00.000Z"),
    daily("retry-2", "2026-08-16T01:16:00.000Z", {}, "retry-1"),
    daily("retry-3", "2026-08-16T01:17:00.000Z", {}, "retry-2"),
  ];
  const index = buildCanonicalEditionIndex(snapshots);
  assert.deepEqual(index.map((edition) => edition.snapshotId), ["retry-3"]);
});

test("morning and evening slot identity stays persisted on the edition index", () => {
  const index = buildCanonicalEditionIndex([
    daily("morning", "2026-08-16T01:15:00.000Z", { scheduleSlot: "morning", scheduledFor: "2026-08-16T01:15:00.000Z" }),
    daily("evening", "2026-08-16T13:15:00.000Z", { scheduleSlot: "evening", scheduledFor: "2026-08-16T13:15:00.000Z" }),
  ]);
  assert.deepEqual(index.map((edition) => [edition.slot, edition.scheduledFor]), [
    ["evening", "2026-08-16T13:15:00.000Z"],
    ["morning", "2026-08-16T01:15:00.000Z"],
  ]);
});

test("invalid edition IDs safely fall back to the current edition without synthesising history", () => {
  const index = buildCanonicalEditionIndex([daily("current", "2026-08-16T13:15:00.000Z")]);
  const selection = selectCanonicalEdition(index, "missing");
  assert.equal(selection.status, "invalid_fallback_current");
  assert.equal(selection.selected?.snapshotId, "current");
});

test("legacy snapshots never reconstruct Story state from current tables", () => {
  const snapshot = daily("legacy", "2026-08-15T01:15:00.000Z", { canonicalStoryIds: ["a", "b"] });
  const onlyOneImmutableSnapshot: EditionSnapshot = {
    id: "story-a",
    research_run_id: "run-legacy",
    story_id: "a",
    supersedes_snapshot_id: null,
    snapshot_type: "story",
    payload: { id: "a", title: "Only persisted A" },
    published_at: "2026-08-15T01:15:00.000Z",
  };
  const replay = replayImmutableEdition(snapshot, [onlyOneImmutableSnapshot]);

  assert.deepEqual(replay.storyStates, []);
  assert.match(replay.limitation || "", /no partial replay was fabricated/i);
});

test("Hybrid PR #33 contract fields pin current, historical, and invalid requests to canonical snapshot IDs", () => {
  const immutableHistoricalState = {
    id: "story-historical",
    slug: "historical-story",
    title: "Published historical Story",
    thesis: "Published historical thesis",
    status: "developing",
    confidence: 80,
    rank: 1,
    featuredRank: 1,
    assets: ["UKOIL"],
    strongestSupport: "Published support",
    imageUrl: "https://example.com/published.jpg",
    intelligence: { lifecycleStatus: "developing" },
    thesisVersion: { id: "version-historical", version: 2, effectiveAt: "2026-08-15T01:15:00.000Z", changeReason: "published" },
  };
  const snapshots = [
    daily("historical", "2026-08-15T01:15:00.000Z", {
      canonicalStoryManifest: [{ position: 1, snapshotId: "story-snapshot-historical", storyId: "story-historical", state: immutableHistoricalState }],
    }),
    daily("current", "2026-08-16T13:15:00.000Z", { scheduleSlot: "evening", scheduledFor: "2026-08-16T13:15:00.000Z" }),
  ];
  const currentStory = {
    id: "story-current", slug: "current-story", title: "Current Story", thesis: "Current thesis", status: "developing", confidence: 70,
    rank: 1, market_question: "Current question", dominant_narrative: null, best_explanation: null,
    strongest_support: "Current support", strongest_contradiction: null, priced_assessment: null,
    confirmation_trigger: null, invalidation_trigger: null, next_catalyst: null,
    article_angle: null, provisional_title: null, article_verdict: null, assets: ["SPX"],
    source_quality: 70, novelty: 70, persistence: 70, trader_relevance: 70, article_potential: 70,
  };
  const input = {
    snapshots,
    currentStoryStates: [currentStory],
    currentFeaturedStoryStates: [currentStory],
  };

  const historical = buildCanonicalEditionResponseContract({ ...input, editionId: "historical" });
  assert.equal(historical.publication.selectedEdition?.snapshotId, "historical");
  assert.equal(historical.canonical.snapshotId, "historical");
  assert.deepEqual(historical.canonical.storyStates, [immutableHistoricalState]);

  const current = buildCanonicalEditionResponseContract(input);
  assert.equal(current.publication.currentEdition?.snapshotId, "current");
  assert.equal(current.publication.selectedEdition?.snapshotId, "current");
  assert.equal(current.canonical.snapshotId, "current");

  const invalid = buildCanonicalEditionResponseContract({ ...input, editionId: "superseded-or-missing" });
  assert.equal(invalid.publication.selectedEdition?.status, "invalid_fallback_current");
  assert.equal(invalid.publication.selectedEdition?.snapshotId, "current");
  assert.equal(invalid.canonical.snapshotId, "current");
});
