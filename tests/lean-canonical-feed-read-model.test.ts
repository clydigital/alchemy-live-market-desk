import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildCanonicalEditionResponseContract,
  type EditionSnapshot,
} from "../lib/edition-replay.ts";

function edition(
  id: string,
  publishedAt: string,
  payload: Record<string, unknown>,
  replayableHint?: boolean,
): EditionSnapshot {
  return {
    id,
    research_run_id: `run-${id}`,
    supersedes_snapshot_id: null,
    snapshot_type: "daily_brief",
    published_at: publishedAt,
    payload,
    replayable_hint: replayableHint,
  };
}

test("lightweight replayability hints keep historical editions discoverable without loading every manifest", () => {
  const current = edition("current", "2026-09-06T13:15:00.000Z", {
    scheduleSlot: "evening",
    scheduledFor: "2026-09-06T13:15:00.000Z",
  });
  const hintedHistorical = edition("historical", "2026-09-06T01:15:00.000Z", {
    scheduleSlot: "morning",
    scheduledFor: "2026-09-06T01:15:00.000Z",
  }, true);

  const response = buildCanonicalEditionResponseContract({
    snapshots: [current, hintedHistorical],
    currentStoryStates: [{ id: "current-story" }],
    currentFeaturedStoryStates: [],
  });

  assert.deepEqual(
    response.publication.editionIndex.map((item) => item.snapshotId),
    ["current", "historical"],
  );
});

test("an explicitly requested hinted edition must still prove exact immutable replay", () => {
  const current = edition("current", "2026-09-06T13:15:00.000Z", {
    scheduleSlot: "evening",
    scheduledFor: "2026-09-06T13:15:00.000Z",
  });
  const hintedButUnloaded = edition("historical", "2026-09-06T01:15:00.000Z", {
    scheduleSlot: "morning",
    scheduledFor: "2026-09-06T01:15:00.000Z",
  }, true);

  const response = buildCanonicalEditionResponseContract({
    snapshots: [current, hintedButUnloaded],
    editionId: "historical",
    currentStoryStates: [{ id: "current-story", title: "Current canonical Story" }],
    currentFeaturedStoryStates: [],
  });

  assert.equal(response.publication.selectedEdition?.status, "invalid_fallback_current");
  assert.equal(response.publication.selectedEdition?.snapshotId, "current");
  assert.equal(response.canonical.snapshotId, "current");
  assert.deepEqual(response.canonical.storyStates, [{ id: "current-story", title: "Current canonical Story" }]);
  assert.match(response.diagnostic.limitation || "", /immutable Story membership|not selectable/i);
});

test("an explicitly requested historical edition replays when its exact persisted manifest is loaded", () => {
  const current = edition("current", "2026-09-06T13:15:00.000Z", {
    scheduleSlot: "evening",
    scheduledFor: "2026-09-06T13:15:00.000Z",
  });
  const historical = edition("historical", "2026-09-06T01:15:00.000Z", {
    scheduleSlot: "morning",
    scheduledFor: "2026-09-06T01:15:00.000Z",
    canonicalStoryManifest: [
      {
        position: 1,
        storyId: "historical-story",
        state: { id: "historical-story", title: "Historical immutable Story", featuredRank: 1 },
      },
    ],
  }, true);

  const response = buildCanonicalEditionResponseContract({
    snapshots: [current, historical],
    editionId: "historical",
    currentStoryStates: [{ id: "current-story" }],
    currentFeaturedStoryStates: [],
  });

  assert.equal(response.publication.selectedEdition?.status, "historical");
  assert.equal(response.canonical.snapshotId, "historical");
  assert.equal(response.canonical.storyStates[0]?.title, "Historical immutable Story");
});

test("reader queries exclude known multi-megabyte operational blobs", () => {
  const source = readFileSync(new URL("../lib/intelligence/publication-feed-data.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /intelligence_engine_runs[\s\S]{0,400}metadata/);
  assert.doesNotMatch(source, /select=\*&snapshot_type=eq\.daily_brief&order=published_at/);
  assert.match(source, /select=\*&id=eq\.\$\{encodeURIComponent\(snapshotId\)\}&snapshot_type=eq\.daily_brief&limit=1/);
  assert.match(source, /manifest_story_id:payload->canonicalStoryManifest->0->state->>id/);
  assert.match(source, /select=id,research_run_id,slot_run_id,story_id,story_thesis_version_id,supersedes_snapshot_id,snapshot_type,public_summary,confidence,published_at,expires_at/);
});

test("canonical feed never reloads the broad internal desk model", () => {
  const route = readFileSync(new URL("../lib/intelligence/publication-feed-route.ts", import.meta.url), "utf8");
  const data = readFileSync(new URL("../lib/intelligence/publication-feed-data.ts", import.meta.url), "utf8");

  assert.doesNotMatch(route, /getDeskData/);
  assert.match(route, /buildCaseMonitorBoards\(\{[\s\S]*macroObservations: data\.macroObservations/);
  assert.doesNotMatch(data, /research_intake_queue[\s\S]{0,200}select=\*/);
  assert.match(data, /monitorResearchIntake/);
});
