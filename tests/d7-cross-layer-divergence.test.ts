import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildD7CrossLayerDivergence,
  D7_CROSS_LAYER_DIVERGENCE_VERSION,
} from "../lib/dossier-v2/cross-layer-divergence.ts";

const PERSISTENT_ID = "11111111-1111-4111-8111-111111111111";

function dossier(overrides: Record<string, unknown> = {}) {
  return {
    asOf: "2026-10-06T00:00:00.000Z",
    header: {
      regimeFamily: "RATES_LED_TIGHTENING",
    },
    whatMattersNow: {
      stories: [{
        id: "story:rates",
        persistentStoryId: PERSISTENT_ID,
        title: "Rates stress",
      }],
    },
    evidenceSufficiency: {
      stories: [{
        analyticalStoryId: "story:rates",
        persistentStoryId: PERSISTENT_ID,
        direction: "STRENGTHEN",
        activeSupportingEvidenceRefs: ["ev:1"],
        activeContradictingEvidenceRefs: [],
        newSupportingEvidenceRefs: ["ev:1"],
        newContradictingEvidenceRefs: [],
        acceleratingEvidenceRefs: [],
        supersededSupportingEvidenceRefs: [],
        blockers: [],
        highConfidenceBlocked: false,
        reason: "New support",
      }],
    },
    longitudinalAdjudication: {
      reactionOutcome: "CONFIRMED",
    },
    investigationAudit: [],
    ...overrides,
  } as any;
}

function hybrid(overrides: Record<string, unknown> = {}) {
  return {
    storyClassifications: [{
      storyId: PERSISTENT_ID,
      storySlug: "rates-stress",
      title: "Rates stress",
      classification: "CONFIRMING",
      reason: "Supported",
      canonicalEvidenceCount: 1,
      latestEventAt: "2026-10-05T23:00:00.000Z",
      latestVersionNumber: 2,
    }],
    scenarios: {
      transfers: [{
        donor: "A",
        recipient: "B",
        amount: 5,
        reason: "Rates-led tightening",
        transitionState: "CONFIRMED",
      }],
    },
    ...overrides,
  } as any;
}

function regimes(input: {
  contributes?: boolean;
  includeStory?: boolean;
} = {}) {
  return [{
    slug: "global-cost-of-capital",
    stories: input.includeStory === false
      ? []
      : [{
          id: PERSISTENT_ID,
          contributesToState: input.contributes ?? true,
        }],
  }] as any;
}

function investigation(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv:rates",
    expectedReaction: "2Y yields should rise.",
    divergence: "MATERIAL",
    storyIds: ["story:rates"],
    reactionCalibration: {
      outcome: "DIVERGENT",
    },
    reactionChecks: [{
      triggerEvidenceRef: "ev:trigger",
      marketEvidenceRef: "ev:market",
    }],
    ...overrides,
  } as any;
}

test("D7 aligns directional Dossier evidence with matching canonical Story state", () => {
  const result = buildD7CrossLayerDivergence({
    dossier: dossier(),
    hybrid: hybrid(),
    regimes: regimes(),
  });

  assert.equal(result.contractVersion, D7_CROSS_LAYER_DIVERGENCE_VERSION);
  const item = result.cases.find((row) => row.pair === "DOSSIER_STORY");
  assert.equal(item?.state, "ALIGNMENT");
  assert.equal(item?.persistentStoryId, PERSISTENT_ID);
  assert.deepEqual(item?.evidenceRefs, ["ev:1"]);
});

test("D7 detects Dossier versus Story directional contradiction", () => {
  const result = buildD7CrossLayerDivergence({
    dossier: dossier(),
    hybrid: hybrid({
      storyClassifications: [{
        ...hybrid().storyClassifications[0],
        classification: "CONTRADICTING",
      }],
    }),
    regimes: regimes(),
  });

  const item = result.cases.find((row) => row.pair === "DOSSIER_STORY");
  assert.equal(item?.state, "CONTRADICTION");
  assert.equal(item?.severity, "HIGH");
  assert.equal(item?.researchEligible, true);
});

test("D7 reports lag when Dossier moves directionally before canonical Story state resolves", () => {
  const result = buildD7CrossLayerDivergence({
    dossier: dossier(),
    hybrid: hybrid({
      storyClassifications: [{
        ...hybrid().storyClassifications[0],
        classification: "UNRESOLVED",
      }],
    }),
    regimes: regimes(),
  });

  const item = result.cases.find((row) => row.pair === "DOSSIER_STORY");
  assert.equal(item?.state, "LAG");
  assert.equal(item?.researchEligible, true);
});

test("D7 reports Story to Regime lag when strengthening Story remains context-only", () => {
  const result = buildD7CrossLayerDivergence({
    dossier: dossier(),
    hybrid: hybrid(),
    regimes: regimes({ contributes: false }),
  });

  const item = result.cases.find((row) => row.pair === "STORY_REGIME");
  assert.equal(item?.state, "LAG");
  assert.equal(item?.regimeSlug, "global-cost-of-capital");
});

test("D7 aligns Regime with the governed Hybrid transition", () => {
  const result = buildD7CrossLayerDivergence({
    dossier: dossier(),
    hybrid: hybrid(),
    regimes: regimes(),
  });

  const item = result.cases.find((row) => row.pair === "REGIME_HYBRID");
  assert.equal(item?.state, "ALIGNMENT");
});

test("D7 reports Regime to Hybrid lag when the required transition is missing", () => {
  const result = buildD7CrossLayerDivergence({
    dossier: dossier(),
    hybrid: hybrid({ scenarios: { transfers: [] } }),
    regimes: regimes(),
  });

  const item = result.cases.find((row) => row.pair === "REGIME_HYBRID");
  assert.equal(item?.state, "LAG");
  assert.equal(item?.researchEligible, true);
});

test("D7 reports Regime to Hybrid contradiction for an explicit opposite transfer", () => {
  const result = buildD7CrossLayerDivergence({
    dossier: dossier(),
    hybrid: hybrid({
      scenarios: {
        transfers: [{
          donor: "B",
          recipient: "A",
          amount: 5,
          reason: "Opposite move",
          transitionState: "CONFIRMED",
        }],
      },
    }),
    regimes: regimes(),
  });

  const item = result.cases.find((row) => row.pair === "REGIME_HYBRID");
  assert.equal(item?.state, "CONTRADICTION");
  assert.equal(item?.severity, "HIGH");
});

test("D7 converts measured expectation divergence into market contradiction cases", () => {
  const inv = investigation();
  const result = buildD7CrossLayerDivergence({
    dossier: dossier({
      investigationAudit: [inv],
      longitudinalAdjudication: { reactionOutcome: "CONTRADICTED" },
    }),
    hybrid: hybrid(),
    regimes: regimes(),
  });

  const overall = result.cases.find((row) => row.pair === "DOSSIER_MARKET");
  const expected = result.cases.find((row) => row.pair === "EXPECTATION_MARKET");
  const storyMarket = result.cases.find((row) => row.pair === "STORY_MARKET");

  assert.equal(overall?.state, "CONTRADICTION");
  assert.equal(expected?.state, "CONTRADICTION");
  assert.equal(expected?.severity, "HIGH");
  assert.deepEqual(expected?.evidenceRefs, ["ev:market", "ev:trigger"]);
  assert.equal(storyMarket?.state, "CONTRADICTION");
  assert.equal(storyMarket?.persistentStoryId, PERSISTENT_ID);
});

test("D7 Story to Market comparison fails closed when exact persistent Story binding is absent", () => {
  const inv = investigation();
  const result = buildD7CrossLayerDivergence({
    dossier: dossier({
      whatMattersNow: {
        stories: [{
          id: "story:rates",
          persistentStoryId: null,
          title: "Rates stress",
        }],
      },
      investigationAudit: [inv],
    }),
    hybrid: hybrid(),
    regimes: regimes(),
  });

  const storyMarket = result.cases.find((row) => row.pair === "STORY_MARKET");
  assert.equal(storyMarket?.state, "UNRESOLVED");
  assert.equal(storyMarket?.researchEligible, false);
});

test("D7 read model contains no mutation path", () => {
  const source = readFileSync(
    new URL("../lib/dossier-v2/cross-layer-divergence.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(
    source,
    /createSupabase|\.from\(|\.insert\(|\.update\(|intelligence_reevaluation_queue|story_thesis_versions/i,
  );
});
