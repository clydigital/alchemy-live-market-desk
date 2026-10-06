import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type { MarketDossierV2 } from "../lib/dossier-v2/contracts.ts";
import type { ResearchBrainOutputV1 } from "../lib/dossier-v2/research-brain-contracts.ts";
import {
  selectDossierV2Presentation,
  selectExactDossierV2Presentation,
} from "../lib/dossier-v2/presentation-reader.ts";
import {
  buildPresenterDossierEditionContext,
  presenterDossierEditionContextFromPayload,
} from "../lib/presenter-dossier-edition-context.ts";
import {
  buildCanonicalEditionIndex,
  selectCanonicalEdition,
  type EditionSnapshot,
} from "../lib/edition-replay.ts";
import {
  buildPresenterCanonicalStoryCase,
  presenterStorySourcesFromEditionPayload,
} from "../lib/presenter-canonical-story-bridge.ts";
import { buildPresenterHistoricalContextBoundary } from "../lib/presenter-historical-context-boundary.ts";
import type { CanonicalStoryReasoningV1 } from "../lib/intelligence/story-reasoning.ts";

const STORY_ID = "story-1";
const DOSSIER_PRIOR = "11111111-1111-4111-8111-111111111111";
const DOSSIER_N = "22222222-2222-4222-8222-222222222222";
const DOSSIER_N1 = "33333333-3333-4333-8333-333333333333";
const VERSION_N = "44444444-4444-4444-8444-444444444444";
const VERSION_N1 = "55555555-5555-4555-8555-555555555555";

function investigation(input: {
  expected: string;
  observed: string;
  explanation: string;
  researchNext: string;
  divergence?: "MATERIAL" | "PARTIAL" | "NONE" | "UNRESOLVED";
}): ResearchBrainOutputV1["investigations"][number] {
  return {
    investigation_id: "inv-rates",
    question: "Did the rates surprise transmit through the expected duration channel?",
    why_it_matters: "The answer determines whether the rates impulse is durable.",
    current_explanation: input.explanation,
    expected_reaction: input.expected,
    observed_reaction: input.observed,
    divergence: input.divergence ?? "MATERIAL",
    competing_explanations: ["Positioning could temporarily distort the measured tape."],
    observed_evidence: ["ev-trigger", "ev-market"],
    missing_evidence: ["Options positioning"],
    research_next: input.researchNext,
    chart_task_links: [],
    confirmation_condition: "The same transmission appears in the next comparable window.",
    invalidation_condition: "The relationship reverses on comparable evidence.",
    status: "open",
    linked_story_ids: [STORY_ID],
    linked_thesis_ids: ["thesis:rates"],
    leads_referenced: [],
  };
}

function brain(inv: ResearchBrainOutputV1["investigations"][number]): ResearchBrainOutputV1 {
  return {
    contract_version: "research-brain/1",
    packet_id: "packet-p17",
    as_of: "2026-10-05T00:00:00.000Z",
    main_thread: {
      thread_id: "thread-rates",
      headline: "Rates remain the dominant cross-asset constraint.",
      answer: "Duration transmission remains the central test.",
      regime_implication: "Long-end yields remain restrictive.",
      regime_family: "RATES_LED_TIGHTENING",
      epistemic_label: "SUPPORTED",
      evidence_references: ["ev-trigger", "ev-market"],
      supporting_story_ids: [STORY_ID],
      contradiction_references: [],
      what_would_change_mind: "A durable easing in long-end yields.",
    },
    major_stories: [{
      story_id: STORY_ID,
      title: "Rates and financing conditions",
      what_changed: "Long-end yields remain elevated.",
      why_it_matters: "Financing conditions stay restrictive.",
      headline_decomposition: "Long-end rates remain elevated.",
      causal_mechanism: "Higher long-end yields raise the cost of capital.",
      market_evidence: {
        confirming: ["ev-market"],
        contradicting: [],
        unresolved: [],
      },
      conclusion: "Rates remain restrictive.",
      what_would_change_mind: "A durable easing in yields.",
      linked_thesis_ids: ["thesis:rates"],
      linked_investigation_ids: ["inv-rates"],
      linked_chart_task_ids: [],
      epistemic_label: "SUPPORTED",
      evidence_ids: ["ev-market"],
    }],
    chart_investigation_queue: { core: [], optional: [] },
    investigations: [inv],
    market_verdict: {
      verdict_id: "verdict-rates",
      lenses: {},
      cross_asset_readthrough: "Rates remain the dominant constraint.",
      epistemic_label: "SUPPORTED",
      dominant_confirmation: "Long-end yields",
      dominant_contradiction: "None",
    },
    research_now: [],
    stock_radar: [],
    developing_themes: [],
    creator_theme_expansions: [],
    thesis_ledger: {
      contract_version: "thesis-ledger/2",
      entries: [{
        thesis_id: "thesis:rates",
        contract_version: "thesis-ledger/2",
        root_thesis_id: "thesis:rates",
        parent_thesis_id: null,
        successor_thesis_id: null,
        title: "Rates thesis",
        statement: "Long-end yields remain restrictive.",
        state: "confirmed",
        version: 2,
        created_at: "2026-10-04T00:00:00.000Z",
        updated_at: "2026-10-05T00:00:00.000Z",
        lineage: [],
        state_reason: "Canonical evidence supports the current state.",
        current_evidence_refs: ["ev-market"],
        observed_market_reaction: inv.observed_reaction,
        next_catalyst_or_tripwire: "Next inflation release",
      }],
    },
    contradictions_detected: [],
    research_gaps: [],
    diagnostics: {
      degraded: false,
      degradation_reasons: [],
      omitted_or_demoted_items: [],
      missing_input_categories: [],
      model_repair_used: false,
      notes: [],
    },
  };
}

function dossier(input: {
  id: string;
  asOf: string;
  previousDossierId: string | null;
  investigation: ResearchBrainOutputV1["investigations"][number];
}): MarketDossierV2 {
  const output = brain(input.investigation);
  return {
    id: input.id,
    contract_version: "market-dossier-v2/1",
    previous_dossier_id: input.previousDossierId,
    as_of: input.asOf,
    freshness: { warnings: [] },
    research_gaps: [],
    payload: {
      contract_version: output.contract_version,
      packet_id: output.packet_id,
      analytical_output: {
        ...output,
        as_of: input.asOf,
      },
    },
    created_at: input.asOf,
  };
}

function reasoning(
  versionId: string,
  versionNumber: number,
  explanation: string,
): CanonicalStoryReasoningV1 {
  const old = versionId === VERSION_N;
  return {
    contractVersion: "canonical-story-reasoning/v1",
    storyId: STORY_ID,
    storyVersionId: versionId,
    versionNumber,
    effectiveAt: old ? "2026-10-05T01:00:00.000Z" : "2026-10-05T03:00:00.000Z",
    title: "Rates and financing conditions",
    centralQuestion: "Are long-end yields a durable financing constraint?",
    lifecycle: "developing",
    confidence: old ? 74 : 86,
    thesis: old ? "Version N thesis." : "Version N+1 thesis.",
    whatChanged: old ? "Version N change." : "Version N+1 change.",
    previousState: old ? "Prior-to-N state." : "Version N state.",
    currentState: old ? "Version N state." : "Version N+1 state.",
    marketReaction: old ? "Version N canonical market reaction." : "Version N+1 canonical market reaction.",
    acceptedExplanation: explanation,
    explanationCandidates: [{
      hypothesisId: old ? "hyp-n-leading" : "hyp-n1-leading",
      mechanismCode: "UNKNOWN",
      statement: old ? "Version N leading explanation." : "Version N+1 leading explanation.",
      causalMechanism: old ? "Version N mechanism." : "Version N+1 mechanism.",
      confidence: old ? 74 : 86,
      evidenceForIds: [old ? "ev-n" : "ev-n1"],
      evidenceAgainstIds: [],
      isLeading: true,
    }, {
      hypothesisId: old ? "hyp-n-competing" : "hyp-n1-competing",
      mechanismCode: "PRICED_IN",
      statement: old ? "Version N competing explanation." : "Version N+1 competing explanation.",
      causalMechanism: old ? "Version N competing mechanism." : "Version N+1 competing mechanism.",
      confidence: 42,
      evidenceForIds: [old ? "ev-n-alt" : "ev-n1-alt"],
      evidenceAgainstIds: [],
      isLeading: false,
    }],
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
    confirmation: [old ? "Version N confirmation." : "Version N+1 confirmation."],
    invalidation: [old ? "Version N invalidation." : "Version N+1 invalidation."],
    nextTest: {
      id: old ? "next-n" : "next-n1",
      label: old ? "Version N next discriminator." : "Version N+1 next discriminator.",
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

function edition(input: {
  id: string;
  scheduledFor: string;
  versionId: string;
  versionNumber: number;
  storyExplanation: string;
  presenterDossierContext?: Record<string, unknown>;
}): EditionSnapshot {
  return {
    id: input.id,
    research_run_id: `run-${input.id}`,
    supersedes_snapshot_id: null,
    snapshot_type: "daily_brief",
    published_at: input.scheduledFor,
    payload: {
      scheduleSlot: input.versionNumber === 7 ? "morning" : "afternoon",
      scheduledFor: input.scheduledFor,
      ...(input.presenterDossierContext
        ? { presenterDossierContext: input.presenterDossierContext }
        : {}),
      canonicalStoryManifest: [{
        position: 1,
        snapshotId: `story-snapshot-${input.id}`,
        storyId: STORY_ID,
        thesisVersionId: input.versionId,
        state: {
          id: STORY_ID,
          thesisVersion: {
            id: input.versionId,
            version: input.versionNumber,
          },
        },
        reasoning: reasoning(
          input.versionId,
          input.versionNumber,
          input.storyExplanation,
        ),
      }],
    },
  };
}

test("P1.7 publication N -> current N+1 -> select N replays exact old Dossier case plus exact old Story reasoning", () => {
  const prior = dossier({
    id: DOSSIER_PRIOR,
    asOf: "2026-10-05T00:30:00.000Z",
    previousDossierId: null,
    investigation: investigation({
      expected: "Pre-N expectation: easing rates should support duration.",
      observed: "Pre-N tape.",
      explanation: "Pre-N Dossier explanation.",
      researchNext: "Pre-N discriminator.",
      divergence: "UNRESOLVED",
    }),
  });
  const dossierN = dossier({
    id: DOSSIER_N,
    asOf: "2026-10-05T01:10:00.000Z",
    previousDossierId: DOSSIER_PRIOR,
    investigation: investigation({
      expected: "Version N expectation: easing rates should support duration.",
      observed: "Version N tape: duration stayed weak.",
      explanation: "Version N Dossier explanation.",
      researchNext: "Version N Dossier discriminator.",
      divergence: "MATERIAL",
    }),
  });
  const dossierN1 = dossier({
    id: DOSSIER_N1,
    asOf: "2026-10-05T03:10:00.000Z",
    previousDossierId: DOSSIER_N,
    investigation: investigation({
      expected: "Version N+1 expectation: renewed inflation pressure should weaken duration.",
      observed: "Version N+1 tape: duration sold off further.",
      explanation: "Version N+1 Dossier explanation.",
      researchNext: "Version N+1 Dossier discriminator.",
      divergence: "PARTIAL",
    }),
  });

  // At publication N, dossier N is the exact current persisted Dossier.
  const publicationSelectionN = selectDossierV2Presentation([dossierN, prior]);
  assert.equal(publicationSelectionN.status, "current");
  assert.equal(publicationSelectionN.selectedDossierId, DOSSIER_N);

  const frozenDossierContextN = buildPresenterDossierEditionContext(
    publicationSelectionN,
    "2026-10-05T01:15:00.000Z",
  );
  assert.equal(frozenDossierContextN.status, "BOUND");

  const oldEdition = edition({
    id: "edition-n",
    scheduledFor: "2026-10-05T01:15:00.000Z",
    versionId: VERSION_N,
    versionNumber: 7,
    storyExplanation: "Version N accepted Story explanation.",
    presenterDossierContext: frozenDossierContextN,
  });

  // Later mutable/current state moves to N+1.
  const currentSelectionN1 = selectDossierV2Presentation([dossierN1, dossierN, prior]);
  assert.equal(currentSelectionN1.selectedDossierId, DOSSIER_N1);
  assert.equal(
    currentSelectionN1.presentation?.watchNext[0]?.observedReaction,
    "Version N+1 tape: duration sold off further.",
  );

  const frozenDossierContextN1 = buildPresenterDossierEditionContext(
    currentSelectionN1,
    "2026-10-05T03:15:00.000Z",
  );
  const currentEdition = edition({
    id: "edition-n1",
    scheduledFor: "2026-10-05T03:15:00.000Z",
    versionId: VERSION_N1,
    versionNumber: 8,
    storyExplanation: "Version N+1 accepted Story explanation.",
    presenterDossierContext: frozenDossierContextN1,
  });

  const editionIndex = buildCanonicalEditionIndex([oldEdition, currentEdition]);
  const selected = selectCanonicalEdition(editionIndex, oldEdition.id);
  assert.equal(selected.selected?.snapshotId, oldEdition.id);
  assert.equal(selected.current?.snapshotId, currentEdition.id);

  const selectedEdition = [oldEdition, currentEdition]
    .find((candidate) => candidate.id === selected.selected?.snapshotId);
  assert.ok(selectedEdition);

  // Recover the exact publication-frozen Dossier identity.
  const frozen = presenterDossierEditionContextFromPayload(selectedEdition.payload);
  assert.ok(frozen);
  assert.equal(frozen.dossierId, DOSSIER_N);
  assert.equal(frozen.dossierAsOf, dossierN.as_of);

  // Simulate the exact UUID reader used by P1.6: no current/latest selection.
  const persistedById = new Map([
    [DOSSIER_PRIOR, prior],
    [DOSSIER_N, dossierN],
    [DOSSIER_N1, dossierN1],
  ]);
  const exactRow = persistedById.get(frozen.dossierId!) ?? null;
  const exactPrevious = exactRow?.previous_dossier_id
    ? persistedById.get(exactRow.previous_dossier_id) ?? null
    : null;
  const historicalSelection = selectExactDossierV2Presentation(
    exactRow,
    exactPrevious,
    frozen.dossierId,
  );

  assert.equal(historicalSelection.status, "historical_exact");
  assert.equal(historicalSelection.selectedDossierId, DOSSIER_N);
  assert.equal(historicalSelection.selectedAsOf, frozen.dossierAsOf);
  assert.ok(historicalSelection.presentation);

  const historicalInvestigation = historicalSelection.presentation.watchNext[0];
  assert.ok(historicalInvestigation);
  assert.equal(
    historicalInvestigation.journey.previousExpectedReaction,
    "Pre-N expectation: easing rates should support duration.",
  );
  assert.equal(
    historicalInvestigation.expectedReaction,
    "Version N expectation: easing rates should support duration.",
  );
  assert.equal(
    historicalInvestigation.observedReaction,
    "Version N tape: duration stayed weak.",
  );
  assert.equal(historicalInvestigation.divergence, "MATERIAL");
  assert.deepEqual(historicalInvestigation.missingEvidence, ["Options positioning"]);

  const storySources = presenterStorySourcesFromEditionPayload(selectedEdition.payload);
  const presenterCase = buildPresenterCanonicalStoryCase({
    investigation: historicalInvestigation,
    storySources,
  });
  assert.ok(presenterCase);

  const boundary = buildPresenterHistoricalContextBoundary({
    editionSelectionStatus: "historical",
    selectedEditionId: oldEdition.id,
    currentEditionId: currentEdition.id,
    dossierId: currentSelectionN1.selectedDossierId,
    dossierAsOf: currentSelectionN1.selectedAsOf,
    exactHistoricalDossier: {
      dossierId: historicalSelection.selectedDossierId!,
      dossierAsOf: historicalSelection.selectedAsOf!,
    },
  });

  assert.equal(boundary.scope, "HISTORICAL_FULL_CASE");
  assert.equal(boundary.dossierId, DOSSIER_N);
  assert.equal(presenterCase.thesisVersionId, VERSION_N);
  assert.equal(presenterCase.currentExplanation, "Version N accepted Story explanation.");
  assert.equal(presenterCase.competingExplanations[0]?.hypothesisId, "hyp-n-competing");
  assert.equal(presenterCase.whatToInspectNext.canonical, "Version N next discriminator.");
  assert.deepEqual(presenterCase.confirmation.canonical, ["Version N confirmation."]);
  assert.deepEqual(presenterCase.invalidation.canonical, ["Version N invalidation."]);

  // Nothing from current N+1 is allowed to leak into the replayed Presenter case.
  const replayJson = JSON.stringify({ boundary, presenterCase, historicalInvestigation });
  assert.equal(replayJson.includes(DOSSIER_N1), false);
  assert.equal(replayJson.includes(VERSION_N1), false);
  assert.equal(replayJson.includes("Version N+1 tape"), false);
  assert.equal(replayJson.includes("Version N+1 accepted Story explanation"), false);
});

test("P1.7 legacy edition without frozen Dossier identity remains Story-reasoning-only", () => {
  const currentDossier = dossier({
    id: DOSSIER_N1,
    asOf: "2026-10-05T03:10:00.000Z",
    previousDossierId: DOSSIER_N,
    investigation: investigation({
      expected: "Current expectation.",
      observed: "Current tape.",
      explanation: "Current Dossier explanation.",
      researchNext: "Current Dossier discriminator.",
      divergence: "PARTIAL",
    }),
  });
  const currentSelection = selectDossierV2Presentation([currentDossier]);
  assert.ok(currentSelection.presentation);

  const legacyEdition = edition({
    id: "legacy-edition-n",
    scheduledFor: "2026-10-05T01:15:00.000Z",
    versionId: VERSION_N,
    versionNumber: 7,
    storyExplanation: "Legacy historical Story explanation.",
  });

  assert.equal(
    presenterDossierEditionContextFromPayload(legacyEdition.payload),
    null,
  );

  const storySources = presenterStorySourcesFromEditionPayload(legacyEdition.payload);
  const currentInvestigation = currentSelection.presentation.watchNext[0];
  assert.ok(currentInvestigation);
  const presenterCase = buildPresenterCanonicalStoryCase({
    investigation: currentInvestigation,
    storySources,
  });
  assert.ok(presenterCase);

  const boundary = buildPresenterHistoricalContextBoundary({
    editionSelectionStatus: "historical",
    selectedEditionId: legacyEdition.id,
    currentEditionId: "edition-current",
    dossierId: currentSelection.selectedDossierId,
    dossierAsOf: currentSelection.selectedAsOf,
    exactHistoricalDossier: null,
  });

  assert.equal(boundary.scope, "HISTORICAL_STORY_REASONING_ONLY");
  assert.equal(boundary.historicalDossierReplayAvailable, false);
  assert.equal(boundary.dossierSource, "CURRENT_DOSSIER");
  assert.equal(presenterCase.thesisVersionId, VERSION_N);
  assert.equal(presenterCase.observedReaction, "Current tape.");
  assert.match(boundary.reason, /no valid publication-frozen Dossier identity could be replayed/);
});

test("P1.7 runtime path preserves exact-vintage separation between historical Presenter and current Hybrid context", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const page = fs.readFileSync(path.join(root, "app", "hybrid-output", "page.tsx"), "utf8");
  const loader = fs.readFileSync(
    path.join(root, "lib", "presenter-historical-dossier-replay.ts"),
    "utf8",
  );

  assert.match(page, /loadPresenterHistoricalDossierReplay\(selectedPresenterEdition\?\.payload\)/);
  assert.match(page, /const presenterDossier = presenterHistoricalDossierReplay\?\.status === "BOUND"/);
  assert.match(page, /investigations: presenterDossier\.watchNext/);
  assert.match(page, /const motionEdition = presenterEditionStatus === "historical"[\s\S]*selectedPresenterEdition[\s\S]*currentEdition/);
  assert.match(page, /marketMotionFromEditionPayload\(motionEdition\?\.payload\)/);
  assert.match(page, /presenterEditionStatus === "current"[\s\S]*getCurrentMarketMotion/);
  assert.match(page, /regimes = buildRegimeProjection\([\s\S]*dossier,/);
  assert.match(page, /const focusedDirectRegimeHref = focusedDossierRegimeContext/);
  assert.match(page, /const focusedStoryReadThroughRegimeHref = focusedStoryRoutedDossierContext/);
  assert.match(page, /Open current Regime separately/);
  assert.match(page, /Historical Dossier replay is immutable/);
  assert.match(page, /current-state context and is not part of this historical replay/);
  assert.match(loader, /getDossierV2PresentationSelectionById\(context\.dossierId!\)/);
  assert.doesNotMatch(loader, /getDossierV2PresentationSelection\(\)/);
});

test("P1.7 end-to-end historical replay adds no new reasoning or mutation engine", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const files = [
    "lib/presenter-dossier-edition-context.ts",
    "lib/presenter-historical-dossier-replay.ts",
    "lib/presenter-historical-context-boundary.ts",
    "lib/presenter-canonical-story-bridge.ts",
    "app/hybrid-output/page.tsx",
  ].map((relative) => fs.readFileSync(path.join(root, relative), "utf8"));
  const combined = files.join("\n");

  assert.doesNotMatch(combined, /executeResearchBrain|runIntelligenceEngine/);
  assert.doesNotMatch(combined, /persistMarketDossierV2/);
  assert.doesNotMatch(combined, /executeDossierStoryCanonicalMutation/);
  assert.doesNotMatch(combined, /persistCanonicalStoryReasoning/);
});
