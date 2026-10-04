import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type { DossierPresentationInvestigation } from "../lib/dossier-v2/presentation-adapter.ts";
import {
  buildCanonicalEditionIndex,
  selectCanonicalEdition,
  type EditionSnapshot,
} from "../lib/edition-replay.ts";
import {
  buildPresenterCanonicalStoryCase,
  presenterStorySourcesFromEditionPayload,
} from "../lib/presenter-canonical-story-bridge.ts";
import type { CanonicalStoryReasoningV1 } from "../lib/intelligence/story-reasoning.ts";

const STORY_ID = "story-rates";
const VERSION_N = "11111111-1111-4111-8111-111111111111";
const VERSION_N1 = "22222222-2222-4222-8222-222222222222";

function reasoning(
  versionId: string,
  versionNumber: number,
  explanation: string,
): CanonicalStoryReasoningV1 {
  return {
    contractVersion: "canonical-story-reasoning/v1",
    storyId: STORY_ID,
    storyVersionId: versionId,
    versionNumber,
    effectiveAt: versionNumber === 7
      ? "2026-10-05T01:00:00.000Z"
      : "2026-10-05T02:00:00.000Z",
    title: "Rates and financing",
    centralQuestion: "Are long-end yields a durable financing constraint?",
    lifecycle: "developing",
    confidence: versionNumber === 7 ? 72 : 84,
    thesis: versionNumber === 7 ? "Version N thesis" : "Version N+1 thesis",
    whatChanged: versionNumber === 7 ? "Version N change." : "Version N+1 change.",
    previousState: "Prior state",
    currentState: versionNumber === 7 ? "Version N state" : "Version N+1 state",
    marketReaction: versionNumber === 7 ? "Version N market reaction." : "Version N+1 market reaction.",
    acceptedExplanation: explanation,
    explanationCandidates: [
      {
        hypothesisId: versionNumber === 7 ? "hyp-old-leading" : "hyp-new-leading",
        mechanismCode: "UNKNOWN",
        statement: versionNumber === 7 ? "Old leading mechanism." : "New leading mechanism.",
        causalMechanism: versionNumber === 7 ? "Old causal mechanism." : "New causal mechanism.",
        confidence: versionNumber === 7 ? 72 : 84,
        evidenceForIds: [versionNumber === 7 ? "ev-old" : "ev-new"],
        evidenceAgainstIds: [],
        isLeading: true,
      },
      {
        hypothesisId: versionNumber === 7 ? "hyp-old-competing" : "hyp-new-competing",
        mechanismCode: "PRICED_IN",
        statement: versionNumber === 7 ? "Old competing hypothesis." : "New competing hypothesis.",
        causalMechanism: versionNumber === 7 ? "Old competing mechanism." : "New competing mechanism.",
        confidence: 44,
        evidenceForIds: [versionNumber === 7 ? "ev-old-alt" : "ev-new-alt"],
        evidenceAgainstIds: [],
        isLeading: false,
      },
    ],
    claims: [],
    causalChain: [],
    countercase: {
      strongest: null,
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
    confirmation: [versionNumber === 7 ? "Old confirmation." : "New confirmation."],
    invalidation: [versionNumber === 7 ? "Old invalidation." : "New invalidation."],
    nextTest: {
      id: versionNumber === 7 ? "test-old" : "test-new",
      label: versionNumber === 7 ? "Inspect old-version discriminator." : "Inspect new-version discriminator.",
      status: "upcoming",
      catalystRef: null,
      dueAt: null,
      expiresAt: null,
      evidenceIds: [],
      resolutionEvidenceIds: [],
    },
    visualPlan: [],
  };
}

function edition(
  id: string,
  versionId: string,
  versionNumber: number,
  scheduledFor: string,
  explanation: string,
): EditionSnapshot {
  return {
    id,
    research_run_id: `run-${id}`,
    supersedes_snapshot_id: null,
    snapshot_type: "daily_brief",
    published_at: scheduledFor,
    payload: {
      scheduleSlot: versionNumber === 7 ? "morning" : "afternoon",
      scheduledFor,
      canonicalStoryManifest: [{
        position: 1,
        snapshotId: `story-snapshot-${id}`,
        storyId: STORY_ID,
        thesisVersionId: versionId,
        state: {
          id: STORY_ID,
          thesisVersion: { id: versionId, version: versionNumber },
        },
        reasoning: reasoning(versionId, versionNumber, explanation),
      }],
    },
  };
}

function investigation(): DossierPresentationInvestigation {
  return {
    id: "inv-current",
    status: "open",
    question: "Current Dossier investigation",
    whyItMatters: "The current investigation remains the tape/divergence source.",
    currentExplanation: "Current Dossier fallback explanation.",
    expectedReaction: "Current expected reaction.",
    observedReaction: "Current measured tape.",
    divergence: "MATERIAL",
    competingExplanations: ["Current Dossier alternative."],
    candidateExplanations: [],
    researchNext: "Current Dossier next test.",
    confirmationCondition: "Current Dossier confirmation.",
    invalidationCondition: "Current Dossier invalidation.",
    evidenceRefs: [],
    missingEvidence: [],
    chartIds: [],
    storyIds: [STORY_ID],
    thesisIds: ["thesis:rates"],
    reactionChecks: [],
    reactionCalibration: {
      basis: "SYSTEM1_REACTION_AUDIT",
      outcome: "DIVERGENT",
      precision: "INTRADAY",
      checkCount: 1,
      alignedCount: 0,
      divergentCount: 1,
      reactionWindows: ["30m"],
      expectationChanged: false,
      requiresReview: true,
    },
    journey: {
      currentId: "inv-current",
      previousId: "inv-current",
      matchedBy: "id",
      transition: "DIVERGENCE_DETECTED",
      previousDivergence: "UNRESOLVED",
      currentDivergence: "MATERIAL",
      previousStatus: "open",
      currentStatus: "open",
      previousExpectedReaction: "Preserved pre-tape expectation.",
      currentExpectedReaction: "Current expected reaction.",
      expectationChanged: false,
      question: "Current Dossier investigation",
    },
  };
}

test("P1.3 selected historical edition pins Presenter explanation/mechanisms to version N", () => {
  const oldEdition = edition(
    "edition-n",
    VERSION_N,
    7,
    "2026-10-05T01:15:00.000Z",
    "Historical version N accepted explanation.",
  );
  const currentEdition = edition(
    "edition-n1",
    VERSION_N1,
    8,
    "2026-10-05T02:15:00.000Z",
    "Latest version N+1 accepted explanation.",
  );

  const index = buildCanonicalEditionIndex([oldEdition, currentEdition]);
  assert.equal(index[0]?.snapshotId, currentEdition.id);

  const selection = selectCanonicalEdition(index, oldEdition.id);
  assert.equal(selection.selected?.snapshotId, oldEdition.id);

  const selectedSnapshot = [oldEdition, currentEdition]
    .find((item) => item.id === selection.selected?.snapshotId);
  assert.ok(selectedSnapshot);

  const storySources = presenterStorySourcesFromEditionPayload(selectedSnapshot.payload);
  const presenterCase = buildPresenterCanonicalStoryCase({
    investigation: investigation(),
    storySources,
  });

  assert.ok(presenterCase);
  assert.equal(presenterCase.thesisVersionId, VERSION_N);
  assert.equal(presenterCase.currentExplanation, "Historical version N accepted explanation.");
  assert.equal(presenterCase.competingExplanations[0]?.hypothesisId, "hyp-old-competing");
  assert.equal(presenterCase.whatToInspectNext.canonical, "Inspect old-version discriminator.");
  assert.deepEqual(presenterCase.confirmation.canonical, ["Old confirmation."]);
  assert.deepEqual(presenterCase.invalidation.canonical, ["Old invalidation."]);

  // The latest immutable edition exists, but its reasoning does not leak into
  // the explicitly selected historical Presenter reasoning path.
  assert.notEqual(presenterCase.thesisVersionId, VERSION_N1);
  assert.notEqual(presenterCase.currentExplanation, "Latest version N+1 accepted explanation.");
});

test("P1.3 current edition remains default when no historical edition is requested", () => {
  const oldEdition = edition(
    "edition-n",
    VERSION_N,
    7,
    "2026-10-05T01:15:00.000Z",
    "Historical version N accepted explanation.",
  );
  const currentEdition = edition(
    "edition-n1",
    VERSION_N1,
    8,
    "2026-10-05T02:15:00.000Z",
    "Latest version N+1 accepted explanation.",
  );

  const index = buildCanonicalEditionIndex([oldEdition, currentEdition]);
  const selection = selectCanonicalEdition(index, null);
  assert.equal(selection.current?.snapshotId, currentEdition.id);
  assert.equal(selection.selected?.snapshotId, currentEdition.id);

  const selectedSnapshot = [oldEdition, currentEdition]
    .find((item) => item.id === selection.selected?.snapshotId);
  assert.ok(selectedSnapshot);

  const presenterCase = buildPresenterCanonicalStoryCase({
    investigation: investigation(),
    storySources: presenterStorySourcesFromEditionPayload(selectedSnapshot.payload),
  });

  assert.ok(presenterCase);
  assert.equal(presenterCase.thesisVersionId, VERSION_N1);
  assert.equal(presenterCase.currentExplanation, "Latest version N+1 accepted explanation.");
});

test("P1.3 invalid edition request falls back to current immutable edition", () => {
  const currentEdition = edition(
    "edition-n1",
    VERSION_N1,
    8,
    "2026-10-05T02:15:00.000Z",
    "Latest version N+1 accepted explanation.",
  );

  const index = buildCanonicalEditionIndex([currentEdition]);
  const selection = selectCanonicalEdition(index, "missing-edition");

  assert.equal(selection.status, "invalid_fallback_current");
  assert.equal(selection.selected?.snapshotId, currentEdition.id);
});

test("P1.3 page uses selected edition only for Presenter reasoning, not current Market Motion", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const page = fs.readFileSync(path.join(root, "app", "hybrid-output", "page.tsx"), "utf8");

  assert.match(page, /selectCanonicalEdition\(\s*presenterEditionIndex,\s*requestedEditionId/);
  assert.match(page, /presenterStorySourcesFromEditionPayload\(selectedPresenterEdition\?\.payload\)/);
  assert.match(page, /marketMotionFromEditionPayload\(currentEdition\?\.payload\)/);
  assert.doesNotMatch(page, /marketMotionFromEditionPayload\(selectedPresenterEdition\?\.payload\)/);
  assert.match(page, /canonicalCases=\{presenterCanonicalCases\}/);
  assert.match(page, /status: presenterEditionStatus/);
});

test("P1.3 UI identifies partial historical replay scope instead of claiming the whole investigation is historical", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const component = fs.readFileSync(
    path.join(root, "components", "live-desk", "PresenterDivergenceJourney.tsx"),
    "utf8",
  );
  const boundary = fs.readFileSync(
    path.join(root, "lib", "presenter-historical-context-boundary.ts"),
    "utf8",
  );

  assert.match(component, /historicalContextBoundary/);
  assert.match(component, /HISTORICAL STORY/);
  assert.match(component, /STORY REASONING ONLY/);
  assert.match(component, /Presenter reasoning edition/);
  assert.match(component, /aria-current=\{selected \? "page" : undefined\}/);
  assert.match(boundary, /Expectation, tape, divergence, and missing-evidence context therefore remain current-Dossier context/);
});

test("P1.3 remains read-only and does not reconstruct historical reasoning from mutable Story state", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const page = fs.readFileSync(path.join(root, "app", "hybrid-output", "page.tsx"), "utf8");
  const component = fs.readFileSync(
    path.join(root, "components", "live-desk", "PresenterDivergenceJourney.tsx"),
    "utf8",
  );
  const bridge = fs.readFileSync(
    path.join(root, "lib", "presenter-canonical-story-bridge.ts"),
    "utf8",
  );
  const combined = [page, component, bridge].join("\n");

  assert.doesNotMatch(combined, /executeDossierStoryCanonicalMutation/);
  assert.doesNotMatch(combined, /persistCanonicalStoryReasoning/);
  assert.doesNotMatch(combined, /story_thesis_versions\?/);
  assert.doesNotMatch(combined, /runIntelligenceEngine|executeResearchBrain/);
});
