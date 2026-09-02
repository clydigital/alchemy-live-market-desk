import test from "node:test";
import assert from "node:assert/strict";

import { composeDossierBriefing } from "../lib/intelligence/dossier-briefing.ts";
import { composeAlchemyEdition, type AlchemyEdition, type EditionStory } from "../lib/intelligence/edition.ts";
import type { JourneyStorySource } from "../lib/intelligence/journey-briefing.ts";
import type { CanonicalStoryReasoningV1 } from "../lib/intelligence/story-reasoning.ts";

function story(id: string, confidence: number, changed = false): EditionStory {
  return {
    id,
    parentStoryId: id,
    lifecycleStatus: "confirmed",
    title: id,
    centralQuestion: `What is happening with ${id}?`,
    thesis: `${id} thesis`,
    whatChanged: `${id} changed`,
    previousState: `${id} previous`,
    currentState: `${id} current`,
    marketReaction: `${id} reaction`,
    acceptedExplanation: `${id} explanation`,
    contradiction: `${id} contradiction`,
    overlookedVariable: `${id} overlooked`,
    overlookedVariableEvidenceStatus: "inferred",
    marketMayBeRight: `${id} countercase`,
    mechanismSteps: [],
    plainEnglish: `${id} plain English`,
    affectedAssets: id.includes("ai") ? ["NVDA"] : [],
    themes: [id],
    nextTest: `${id} next test`,
    confirmation: `${id} confirms`,
    invalidation: `${id} invalidates`,
    confidence,
    prohibitedClaims: [],
    changeKinds: changed ? ["catalyst"] : [],
    eventAt: "2026-09-02T00:00:00Z",
  };
}

function source(id: string, position: number, confidence: number | undefined): JourneyStorySource {
  const versionId = `${id}-version`;
  const reasoning: CanonicalStoryReasoningV1 = {
    contractVersion: "canonical-story-reasoning/v1",
    storyId: id,
    storyVersionId: versionId,
    versionNumber: 1,
    effectiveAt: "2026-09-02T00:00:00Z",
    title: id,
    centralQuestion: `What is happening with ${id}?`,
    lifecycle: "confirmed",
    confidence: confidence as number,
    thesis: `${id} thesis`,
    whatChanged: `${id} changed`,
    previousState: `${id} previous`,
    currentState: `${id} current`,
    marketReaction: `${id} reaction`,
    acceptedExplanation: `${id} explanation`,
    claims: [{ id: `${id}-claim`, type: "fact", text: `${id} fact`, evidenceIds: [`${id}-evidence`] }],
    causalChain: [],
    countercase: {
      strongest: `${id} countercase`,
      evidenceIds: [`${id}-evidence`],
      weakestLink: `${id} weakest link`,
      marketMayBeRight: `${id} market may be right`,
    },
    overlookedVariable: {
      text: `${id} overlooked`,
      evidenceState: "inferred",
      evidenceIds: [`${id}-evidence`],
    },
    assetImplications: [],
    confirmation: [`${id} confirms`],
    invalidation: [`${id} invalidates`],
    nextTest: null,
    visualPlan: [],
  };
  return {
    position,
    publicationSnapshotId: `${id}-snapshot`,
    storyId: id,
    thesisVersionId: versionId,
    reasoning,
  };
}

function emptyEdition(stories: EditionStory[] = []): AlchemyEdition {
  return composeAlchemyEdition({
    generatedAt: "2026-09-01T00:00:00Z",
    comparisonWindowStart: "2026-08-31T00:00:00Z",
    stories,
    marketTape: { regimeSummary: "No canonical tape", assets: [] },
  });
}

test("persistent reasoning keeps immutable confidence as context without outranking a current delta", () => {
  const weakDelta = story("weak-calendar-delta", 1, true);
  const persistentId = "persistent-ai";
  const result = composeDossierBriefing({
    generatedAt: "2026-09-02T00:00:00Z",
    stories: [weakDelta],
    changes: [{ id: weakDelta.id }],
    storySources: [
      source(weakDelta.id, 1, 1),
      source(persistentId, 5, undefined),
    ],
    storyContext: [{ id: persistentId, confidence: 95, affectedAssets: ["NVDA"], themes: ["AI"] }],
    marketTape: { regimeSummary: "AI financing and rates remain active", assets: [] },
    upcoming: { economicCalendar: [], earnings: [], geopoliticalClock: [] },
    diagnostics: { warnings: [], eventHorizonCoverage: [] },
  });

  assert.equal(result.lessons[0].storyId, weakDelta.id);
  assert.equal(result.lessons.find((lesson) => lesson.storyId === persistentId)?.confidence, 95);
  assert.ok(result.lessons.some((lesson) => lesson.storyId === persistentId));
  assert.ok(result.opening.topicChips.includes("NVDA"));
});

test("edition composition reads persistent confidence from the prior immutable manifest as secondary context", () => {
  const persistent = story("persistent-ai", 95);
  const weakDelta = story("weak-calendar-delta", 1, true);
  const previous = emptyEdition() as AlchemyEdition & {
    canonicalStoryManifest: Array<{ storyId: string; state: Record<string, unknown> }>;
  };
  previous.canonicalStoryManifest = [{
    storyId: persistent.id,
    state: { id: persistent.id, confidence: 95, assets: ["NVDA"], themes: ["AI"] },
  }];

  const current = composeAlchemyEdition({
    generatedAt: "2026-09-02T00:00:00Z",
    comparisonWindowStart: "2026-09-01T00:00:00Z",
    stories: [weakDelta],
    previousEdition: previous,
    journeyStorySources: [
      source(weakDelta.id, 1, 1),
      source(persistent.id, 5, undefined),
    ],
    marketTape: { regimeSummary: "No canonical tape", assets: [] },
  });

  assert.equal(current.dossier?.lessons[0].storyId, weakDelta.id);
  assert.equal(current.dossier?.lessons.find((lesson) => lesson.storyId === persistent.id)?.confidence, 95);
  assert.ok(current.dossier?.lessons.some((lesson) => lesson.storyId === persistent.id));
});

test("persistent Story is omitted rather than assigned a fabricated confidence when immutable context is unavailable", () => {
  const weakDelta = story("weak-calendar-delta", 1, true);
  const persistentId = "legacy-without-confidence";
  const result = composeDossierBriefing({
    generatedAt: "2026-09-02T00:00:00Z",
    stories: [weakDelta],
    changes: [{ id: weakDelta.id }],
    storySources: [
      source(weakDelta.id, 1, 1),
      source(persistentId, 2, undefined),
    ],
    marketTape: { regimeSummary: "No canonical tape", assets: [] },
    upcoming: { economicCalendar: [], earnings: [], geopoliticalClock: [] },
    diagnostics: { warnings: [], eventHorizonCoverage: [] },
  });

  assert.ok(!result.lessons.some((lesson) => lesson.storyId === persistentId));
  assert.ok(result.diagnostics.warnings.some((warning) => warning.includes("canonical confidence is unavailable")));
});
