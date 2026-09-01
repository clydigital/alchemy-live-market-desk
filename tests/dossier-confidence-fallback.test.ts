import test from "node:test";
import assert from "node:assert/strict";

import { composeDossierBriefing } from "../lib/intelligence/dossier-briefing.ts";
import type { EditionStory } from "../lib/intelligence/edition.ts";
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
    affectedAssets: [],
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

test("materialised persistent reasoning falls back to persisted Story confidence", () => {
  const persistent = story("persistent-ai", 95);
  const weakDelta = story("weak-calendar-delta", 1, true);
  const result = composeDossierBriefing({
    generatedAt: "2026-09-02T00:00:00Z",
    stories: [weakDelta, persistent],
    changes: [{ id: weakDelta.id }],
    storySources: [
      source(weakDelta.id, 1, 1),
      source(persistent.id, 5, undefined),
    ],
    marketTape: { regimeSummary: "No canonical tape", assets: [] },
    upcoming: { economicCalendar: [], earnings: [], geopoliticalClock: [] },
    diagnostics: { warnings: [], eventHorizonCoverage: [] },
  });

  assert.equal(result.lessons[0].storyId, persistent.id);
  assert.equal(result.lessons[0].confidence, 95);
  assert.ok(result.lessons.some((lesson) => lesson.storyId === weakDelta.id));
});
