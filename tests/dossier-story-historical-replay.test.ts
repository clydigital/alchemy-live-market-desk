import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildCanonicalEditionResponseContract,
  replayImmutableEdition,
  type EditionSnapshot,
} from "../lib/edition-replay.ts";

const STORY_ID = "story-rates";
const VERSION_N = "11111111-1111-4111-8111-111111111111";
const VERSION_N1 = "22222222-2222-4222-8222-222222222222";

function daily(
  id: string,
  publishedAt: string,
  payload: Record<string, unknown>,
): EditionSnapshot {
  return {
    id,
    research_run_id: `run-${id}`,
    supersedes_snapshot_id: null,
    snapshot_type: "daily_brief",
    payload,
    published_at: publishedAt,
  };
}

function frozenReasoning(versionId = VERSION_N, thesis = "Version N thesis") {
  return {
    contractVersion: "canonical-story-reasoning/v1",
    storyId: STORY_ID,
    storyVersionId: versionId,
    versionNumber: versionId === VERSION_N ? 7 : 8,
    effectiveAt: versionId === VERSION_N
      ? "2026-10-05T01:00:00.000Z"
      : "2026-10-05T02:00:00.000Z",
    title: "Rates and cost of capital",
    centralQuestion: "Are long-end yields a durable financing constraint?",
    lifecycle: "developing",
    confidence: versionId === VERSION_N ? 76 : 83,
    thesis,
    whatChanged: versionId === VERSION_N
      ? "Version N canonical evidence narrowed the mechanism."
      : "Later evidence changed the live Story.",
    previousState: "Prior state",
    currentState: versionId === VERSION_N ? "Version N state" : "Version N+1 state",
    marketReaction: null,
    acceptedExplanation: versionId === VERSION_N
      ? "Version N accepted explanation."
      : "Version N+1 accepted explanation.",
    claims: [{
      id: `claim:${versionId}`,
      type: "thesis",
      text: thesis,
      evidenceIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
    }],
    causalChain: [],
    countercase: {
      strongest: "Countercase",
      evidenceIds: [],
      weakestLink: null,
      marketMayBeRight: null,
    },
    overlookedVariable: {
      text: null,
      evidenceState: null,
      evidenceIds: [],
    },
    assetImplications: [],
    confirmation: ["Confirmation"],
    invalidation: ["Invalidation"],
    nextTest: null,
    visualPlan: [],
  };
}

function historicalEdition(reasoning = frozenReasoning()) {
  return daily("historical-edition", "2026-10-05T01:15:00.000Z", {
    scheduleSlot: "morning",
    scheduledFor: "2026-10-05T01:15:00.000Z",
    canonicalStoryManifest: [{
      position: 1,
      snapshotId: "story-publication-n",
      storyId: STORY_ID,
      thesisVersionId: VERSION_N,
      state: {
        id: STORY_ID,
        title: "Rates and cost of capital",
        thesis: "Version N thesis",
        confidence: 76,
        featuredRank: 1,
        thesisVersion: {
          id: VERSION_N,
          version: 7,
          effectiveAt: "2026-10-05T01:00:00.000Z",
          changeReason: "dossier_story_reassessment",
        },
      },
      reasoning,
    }],
  });
}

test("B4.7 historical replay remains pinned to version N after live Story advances to N+1", () => {
  const reasoningN = frozenReasoning();
  const historical = historicalEdition(reasoningN);
  const current = daily("current-edition", "2026-10-05T02:15:00.000Z", {
    scheduleSlot: "evening",
    scheduledFor: "2026-10-05T02:15:00.000Z",
  });

  const currentStoryN1 = {
    id: STORY_ID,
    title: "Rates and cost of capital - later",
    thesis: "Version N+1 thesis",
    confidence: 83,
    featuredRank: 1,
    thesisVersion: {
      id: VERSION_N1,
      version: 8,
      effectiveAt: "2026-10-05T02:00:00.000Z",
      changeReason: "later_reassessment",
    },
  };

  const result = buildCanonicalEditionResponseContract({
    snapshots: [historical, current],
    editionId: historical.id,
    currentStoryStates: [currentStoryN1],
    currentFeaturedStoryStates: [currentStoryN1],
  });

  assert.equal(result.isHistoricalReplay, true);
  assert.equal(result.canonical.snapshotId, historical.id);
  assert.equal(
    (result.canonical.storyStates[0]?.thesisVersion as { id?: string } | undefined)?.id,
    VERSION_N,
  );
  assert.equal(result.canonical.storyStates[0]?.thesis, "Version N thesis");

  const replayedReasoning = result.canonical.storyReasoningByStoryId[STORY_ID];
  assert.ok(replayedReasoning);
  assert.equal(replayedReasoning.storyVersionId, VERSION_N);
  assert.equal(replayedReasoning.thesis, "Version N thesis");
  assert.notEqual(replayedReasoning.storyVersionId, VERSION_N1);

  // The exact JSON value frozen at publication remains replayed after current
  // Story state has advanced. No mutable current Story reasoning participates.
  assert.equal(JSON.stringify(replayedReasoning), JSON.stringify(reasoningN));
});

test("B4.7 changing current mutable Story input cannot change old edition reasoning", () => {
  const historical = historicalEdition();
  const current = daily("current-edition", "2026-10-05T02:15:00.000Z", {
    scheduledFor: "2026-10-05T02:15:00.000Z",
  });

  const first = buildCanonicalEditionResponseContract({
    snapshots: [historical, current],
    editionId: historical.id,
    currentStoryStates: [{
      id: STORY_ID,
      thesis: "Version N+1 mutable thesis",
      confidence: 83,
      thesisVersion: { id: VERSION_N1 },
    }],
    currentFeaturedStoryStates: [],
  });

  const second = buildCanonicalEditionResponseContract({
    snapshots: [historical, current],
    editionId: historical.id,
    currentStoryStates: [{
      id: STORY_ID,
      thesis: "Version N+2 mutable thesis",
      confidence: 91,
      thesisVersion: { id: "33333333-3333-4333-8333-333333333333" },
    }],
    currentFeaturedStoryStates: [],
  });

  assert.deepEqual(
    first.canonical.storyReasoningByStoryId,
    second.canonical.storyReasoningByStoryId,
  );
  assert.deepEqual(first.canonical.storyStates, second.canonical.storyStates);
});

test("B4.7 manifest reasoning with mismatched Story/version identity fails closed", () => {
  const mismatch = historicalEdition(frozenReasoning(VERSION_N1, "Wrong version reasoning"));
  const replay = replayImmutableEdition(mismatch, []);

  assert.deepEqual(replay.storyStates, []);
  assert.deepEqual(replay.storyReasoningByStoryId, {});
  assert.match(
    replay.limitation || "",
    /reasoning that does not match its immutable Story\/version identity/i,
  );
});

test("B4.7 legacy manifests without raw reasoning remain presentation-replayable", () => {
  const historical = daily("legacy-manifest", "2026-10-05T01:15:00.000Z", {
    canonicalStoryManifest: [{
      position: 1,
      snapshotId: "story-old",
      storyId: STORY_ID,
      thesisVersionId: VERSION_N,
      state: {
        id: STORY_ID,
        thesis: "Older persisted state",
        featuredRank: 1,
        thesisVersion: { id: VERSION_N },
      },
    }],
  });

  const replay = replayImmutableEdition(historical, []);
  assert.equal(replay.limitation, null);
  assert.equal(replay.storyStates[0]?.thesis, "Older persisted state");
  assert.deepEqual(replay.storyReasoningByStoryId, {});
});

test("B4.7 both canonical edition writers persist reasoning from the frozen Story publication snapshot", () => {
  const root = path.resolve(import.meta.dirname, "..");
  for (const relative of [
    ["lib", "intelligence", "runtime.ts"],
    ["lib", "intelligence", "canonical-journey-edition.ts"],
  ]) {
    const source = fs.readFileSync(path.join(root, ...relative), "utf8");
    const start = source.indexOf("async function persistCanonicalStoryManifest");
    assert.notEqual(start, -1, relative.join("/"));
    const end = source.indexOf("\n}\n", start) + 3;
    const section = source.slice(start, end);

    assert.match(section, /const candidateReasoning = snapshot\.payload\.canonicalStoryReasoning/);
    assert.match(section, /storyVersionId === thesisVersionId/);
    assert.match(section, /manifest:[\s\S]*thesisVersionId,[\s\S]*state,[\s\S]*reasoning/);
  }
});

test("B4.7 replay path is snapshot-only and does not query mutable Story tables", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const source = fs.readFileSync(path.join(root, "lib", "edition-replay.ts"), "utf8");

  assert.match(source, /function manifestReplay/);
  assert.match(source, /entry\.reasoning/);
  assert.match(source, /storyReasoningByStoryId/);
  assert.doesNotMatch(source, /from\("stories"\)/);
  assert.doesNotMatch(source, /story_thesis_versions\?/);
  assert.doesNotMatch(source, /fetch\(/);
  assert.doesNotMatch(source, /intelligenceRest/);
});
