import test from "node:test";
import assert from "node:assert/strict";

import { composeDossierBriefing, DOSSIER_BRIEFING_V1 } from "../lib/intelligence/dossier-briefing.ts";
import type { EditionStory } from "../lib/intelligence/edition.ts";
import type { JourneyStorySource } from "../lib/intelligence/journey-briefing.ts";
import type { CanonicalStoryReasoningV1 } from "../lib/intelligence/story-reasoning.ts";

function story(): EditionStory {
  return {
    id: "story-oil-bonds",
    parentStoryId: "story-oil-bonds",
    lifecycleStatus: "developing",
    title: "Oil is becoming a bond story",
    centralQuestion: "How does oil become a bond story?",
    thesis: "Oil inflation is tightening financial conditions through Fed repricing.",
    whatChanged: "Oil risk and front-end yields rose together.",
    previousState: "Oil was mainly a geopolitical premium story.",
    currentState: "Oil is now feeding inflation and rate expectations.",
    marketReaction: "The 2-year yield rose.",
    acceptedExplanation: "Higher oil raises inflation risk and reduces room for easing.",
    contradiction: "Physical supply disruption is not yet fully confirmed.",
    overlookedVariable: "The 2-year yield is the cleaner Fed-path signal.",
    overlookedVariableEvidenceStatus: "strongly_supported",
    marketMayBeRight: "The market may be correctly pricing a more restrictive Fed path.",
    mechanismSteps: [],
    plainEnglish: "Markets can tighten before the Fed actually changes rates because expected policy moves are priced immediately.",
    affectedAssets: ["US02Y", "DXY", "XAUUSD"],
    themes: ["Oil", "Bonds", "Fed"],
    nextTest: "US 2-year yield",
    confirmation: "US02Y remains elevated with firm oil.",
    invalidation: "Oil falls and US02Y retraces.",
    confidence: 82,
    prohibitedClaims: [],
    changeKinds: ["cross_asset_transmission"],
    eventAt: "2026-09-01T08:00:00Z",
  };
}

function source(): JourneyStorySource {
  const reasoning: CanonicalStoryReasoningV1 = {
    contractVersion: "canonical-story-reasoning/v1",
    storyId: "story-oil-bonds",
    storyVersionId: "version-1",
    versionNumber: 1,
    effectiveAt: "2026-09-01T08:00:00Z",
    title: "Oil is becoming a bond story",
    centralQuestion: "How does oil become a bond story?",
    lifecycle: "developing",
    confidence: 82,
    thesis: "Oil inflation is tightening financial conditions through Fed repricing.",
    whatChanged: "Oil risk and front-end yields rose together.",
    previousState: "Oil was mainly a geopolitical premium story.",
    currentState: "Oil is now feeding inflation and rate expectations.",
    marketReaction: "The 2-year yield rose.",
    acceptedExplanation: "Higher oil raises inflation risk and reduces room for easing.",
    claims: [
      { id: "claim-1", type: "fact", text: "Oil and the 2-year yield rose together.", evidenceIds: ["evidence-1"] },
      { id: "claim-2", type: "thesis", text: "Oil inflation is tightening financial conditions through Fed repricing.", evidenceIds: ["evidence-1"] },
    ],
    causalChain: [
      {
        id: "edge-1",
        sourceHypothesisId: "hyp-1",
        from: "Higher oil",
        relationship: "raises",
        to: "inflation risk",
        evidenceState: "strongly_supported",
        evidenceIds: ["evidence-1"],
      },
      {
        id: "edge-2",
        sourceHypothesisId: "hyp-1",
        from: "inflation risk",
        relationship: "raises",
        to: "Fed tightening expectations",
        evidenceState: "inferred",
        evidenceIds: ["evidence-1"],
      },
    ],
    countercase: {
      strongest: "Physical supply disruption is not yet fully confirmed.",
      evidenceIds: ["evidence-1"],
      weakestLink: "The oil shock may fade.",
      marketMayBeRight: "The market may be correctly pricing a more restrictive Fed path.",
    },
    overlookedVariable: {
      text: "The 2-year yield is the cleaner Fed-path signal.",
      evidenceState: "strongly_supported",
      evidenceIds: ["evidence-1"],
    },
    assetImplications: [
      {
        asset: "US02Y",
        bias: "bullish",
        conviction: 75,
        baseCase: "Front-end yields stay supported while inflation risk remains firm.",
        evidenceIds: ["evidence-1"],
        confirmation: "US02Y remains elevated.",
        invalidation: "US02Y retraces with softer oil.",
      },
    ],
    confirmation: ["US02Y remains elevated with firm oil."],
    invalidation: ["Oil falls and US02Y retraces."],
    nextTest: {
      id: "test-1",
      label: "US 2-year yield",
      status: "upcoming",
      catalystRef: null,
      dueAt: null,
      expiresAt: null,
      evidenceIds: ["evidence-1"],
      resolutionEvidenceIds: [],
    },
    visualPlan: [],
  };
  return {
    position: 1,
    publicationSnapshotId: "snapshot-1",
    storyId: "story-oil-bonds",
    thesisVersionId: "version-1",
    reasoning,
  };
}

function variantStory({
  id,
  confidence,
  lifecycleStatus = "developing",
  affectedAssets,
  themes,
  changeKinds = [],
  currentState,
  whatChanged,
}: {
  id: string;
  confidence: number;
  lifecycleStatus?: EditionStory["lifecycleStatus"];
  affectedAssets: string[];
  themes: string[];
  changeKinds?: EditionStory["changeKinds"];
  currentState: string;
  whatChanged: string;
}): EditionStory {
  return {
    ...story(),
    id,
    parentStoryId: id,
    lifecycleStatus,
    title: id,
    centralQuestion: `What is happening with ${id}?`,
    confidence,
    affectedAssets,
    themes,
    changeKinds,
    currentState,
    whatChanged,
  };
}

function variantSource({
  id,
  position,
  confidence,
  lifecycle = "developing",
  asset,
  currentState,
  whatChanged,
}: {
  id: string;
  position: number;
  confidence: number;
  lifecycle?: CanonicalStoryReasoningV1["lifecycle"];
  asset: string;
  currentState: string;
  whatChanged: string;
}): JourneyStorySource {
  const base = source();
  const versionId = `${id}-version`;
  return {
    ...base,
    position,
    publicationSnapshotId: `${id}-snapshot`,
    storyId: id,
    thesisVersionId: versionId,
    reasoning: {
      ...base.reasoning,
      storyId: id,
      storyVersionId: versionId,
      title: id,
      centralQuestion: `What is happening with ${id}?`,
      lifecycle,
      confidence,
      whatChanged,
      currentState,
      assetImplications: base.reasoning.assetImplications.map((impact) => ({ ...impact, asset })),
    },
  };
}

test("composes a question-led Dossier from immutable canonical Story reasoning", () => {
  const result = composeDossierBriefing({
    generatedAt: "2026-09-01T09:00:00Z",
    stories: [story()],
    changes: [{ id: "story-oil-bonds" }],
    storySources: [source()],
    marketTape: {
      regimeSummary: "Oil inflation and higher yields are tightening financial conditions.",
      assets: [{ symbol: "US02Y", move: "+12bp", state: "higher", whyRelevant: "Fed-path repricing" }],
    },
    upcoming: {
      economicCalendar: [{
        time: "2026-09-03T14:00:00Z",
        event: "ISM Services",
        consensus: null,
        prior: null,
        exposedAssets: ["US02Y", "DXY"],
        whyItMatters: "Tests whether inflation/growth pressure is broadening.",
      }],
      earnings: [],
      geopoliticalClock: [],
    },
    diagnostics: { warnings: [], eventHorizonCoverage: [] },
  });

  assert.equal(result.contractVersion, DOSSIER_BRIEFING_V1);
  assert.equal(result.lessons.length, 1);
  assert.equal(result.lessons[0].title, "How does oil become a bond story?");
  assert.equal(result.lessons[0].icon, "energy");
  assert.ok(result.lessons[0].callouts.some((item) => item.type === "plain_english"));
  assert.ok(result.lessons[0].callouts.some((item) => item.type === "why_traders_care"));
  assert.ok(result.lessons[0].callouts.some((item) => item.type === "confirmation"));
  assert.ok(result.lessons[0].callouts.some((item) => item.type === "invalidation"));
  assert.equal(result.primaryStoryline?.links.length, 2);
  assert.equal(result.watchNow[0].variable, "US 2-year yield");
  assert.equal(result.ahead.economicCalendar[0].event, "ISM Services");
  assert.equal(result.readAloud.available, true);
});

test("does not manufacture lessons when immutable reasoning is missing", () => {
  const result = composeDossierBriefing({
    generatedAt: "2026-09-01T09:00:00Z",
    stories: [story()],
    changes: [{ id: "story-oil-bonds" }],
    storySources: [],
    marketTape: { regimeSummary: "No tape", assets: [] },
    upcoming: { economicCalendar: [], earnings: [], geopoliticalClock: [] },
    diagnostics: { warnings: [], eventHorizonCoverage: [] },
  });

  assert.equal(result.lessons.length, 0);
  assert.ok(result.diagnostics.warnings.some((warning) => warning.includes("exact immutable Canonical Story Reasoning")));
});

test("a material current delta outranks persistent confidence while recent tape-linked context remains available", () => {
  const changed = variantStory({
    id: "story-calendar",
    confidence: 1,
    affectedAssets: ["NZDUSD"],
    themes: ["Calendar"],
    changeKinds: ["catalyst"],
    currentState: "The RBNZ schedule is now known.",
    whatChanged: "The RBNZ schedule was published.",
  });
  const persistent = variantStory({
    id: "story-fed-oil",
    confidence: 92,
    affectedAssets: ["US02Y", "DXY", "XAUUSD"],
    themes: ["Oil", "Fed", "Bonds"],
    currentState: "Oil and front-end yields remain linked through inflation repricing.",
    whatChanged: "This relationship was established in an earlier run.",
  });
  const result = composeDossierBriefing({
    generatedAt: "2026-09-02T01:00:00Z",
    stories: [changed, persistent],
    changes: [{ id: changed.id }],
    storySources: [
      variantSource({
        id: changed.id,
        position: 1,
        confidence: 1,
        asset: "NZDUSD",
        currentState: changed.currentState,
        whatChanged: changed.whatChanged,
      }),
      variantSource({
        id: persistent.id,
        position: 2,
        confidence: 92,
        asset: "US02Y",
        currentState: persistent.currentState,
        whatChanged: persistent.whatChanged,
      }),
    ],
    marketTape: {
      regimeSummary: "Oil inflation and higher front-end yields are driving the cross-asset tape.",
      assets: [{ symbol: "US02Y", move: "+10bp", state: "higher", whyRelevant: "Fed repricing" }],
    },
    upcoming: { economicCalendar: [], earnings: [], geopoliticalClock: [] },
    diagnostics: { warnings: [], eventHorizonCoverage: [] },
  });

  assert.equal(result.lessons.length, 2);
  assert.equal(result.lessons[0].storyId, changed.id);
  assert.equal(result.lessons[0].currentAttention.state, "fresh_change");
  assert.ok(result.lessons.some((lesson) => lesson.storyId === persistent.id));
  assert.ok(result.lessons.find((lesson) => lesson.storyId === persistent.id)?.callouts.some((callout) => callout.label.includes("NO MATERIAL CHANGE")));
  assert.ok(result.opening.topicChips.includes("Oil"));
});

test("drops stale invalidated persistent Stories but still explains a changed invalidation", () => {
  const stale = variantStory({
    id: "story-stale",
    confidence: 99,
    lifecycleStatus: "invalidated",
    affectedAssets: ["US02Y"],
    themes: ["Old thesis"],
    currentState: "This thesis is invalidated.",
    whatChanged: "It was invalidated in an earlier run.",
  });
  const changedInvalidation = variantStory({
    id: "story-just-invalidated",
    confidence: 80,
    lifecycleStatus: "invalidated",
    affectedAssets: ["DXY"],
    themes: ["Fed"],
    changeKinds: ["evidence"],
    currentState: "The prior thesis no longer holds.",
    whatChanged: "New evidence invalidated the prior thesis.",
  });
  const result = composeDossierBriefing({
    generatedAt: "2026-09-02T01:00:00Z",
    stories: [stale, changedInvalidation],
    changes: [{ id: changedInvalidation.id }],
    storySources: [
      variantSource({ id: stale.id, position: 1, confidence: 99, lifecycle: "invalidated", asset: "US02Y", currentState: stale.currentState, whatChanged: stale.whatChanged }),
      variantSource({ id: changedInvalidation.id, position: 2, confidence: 80, lifecycle: "invalidated", asset: "DXY", currentState: changedInvalidation.currentState, whatChanged: changedInvalidation.whatChanged }),
    ],
    marketTape: { regimeSummary: "Dollar repricing", assets: [{ symbol: "DXY", move: "-1%", state: "lower", whyRelevant: "Fed repricing" }] },
    upcoming: { economicCalendar: [], earnings: [], geopoliticalClock: [] },
    diagnostics: { warnings: [], eventHorizonCoverage: [] },
  });

  assert.deepEqual(result.lessons.map((lesson) => lesson.storyId), [changedInvalidation.id]);
  assert.equal(result.lessons[0].body[0], changedInvalidation.whatChanged);
});
