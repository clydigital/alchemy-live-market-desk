import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  planDivergenceEvidenceRecruitment,
  DIVERGENCE_EVIDENCE_RECRUITMENT_VERSION,
  type DivergenceRecruitmentBelief,
  type DivergenceRecruitmentDivergence,
  type DivergenceRecruitmentHypothesis,
} from "../lib/intelligence/divergence-evidence-recruitment.ts";

function belief(overrides: Partial<DivergenceRecruitmentBelief> = {}): DivergenceRecruitmentBelief {
  return {
    id: "belief-rates",
    statement: "Long-end rates should ease after softer inflation.",
    affectedAssets: ["US10Y", "US30Y"],
    primaryCategory: "rates",
    themes: ["duration"],
    ...overrides,
  };
}

function divergence(
  overrides: Partial<DivergenceRecruitmentDivergence> = {},
): DivergenceRecruitmentDivergence {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    marketBeliefId: "belief-rates",
    observedChange: "US10Y stayed elevated.",
    expectedChange: "Long-end yields should ease.",
    magnitude: 82,
    persistenceScore: 76,
    ...overrides,
  };
}

function hypothesis(
  overrides: Partial<DivergenceRecruitmentHypothesis> = {},
): DivergenceRecruitmentHypothesis {
  return {
    id: "hyp-rates",
    divergenceId: divergence().id,
    confidence: 78,
    evidenceForIds: ["ev-rates"],
    evidenceAgainstIds: [],
    ...overrides,
  };
}

test("P2.2 recruits only material divergences that remain causally unresolved after Hypothesis", () => {
  const noHypothesis = planDivergenceEvidenceRecruitment({
    divergences: [divergence()],
    beliefs: [belief()],
    hypotheses: [],
  });
  assert.equal(noHypothesis.length, 1);
  assert.equal(noHypothesis[0]?.resolutionState, "NO_CAUSAL_HYPOTHESIS");

  const lowConfidence = planDivergenceEvidenceRecruitment({
    divergences: [divergence()],
    beliefs: [belief()],
    hypotheses: [hypothesis({ confidence: 58 })],
  });
  assert.equal(lowConfidence[0]?.resolutionState, "LOW_CONFIDENCE");

  const conflicted = planDivergenceEvidenceRecruitment({
    divergences: [divergence()],
    beliefs: [belief()],
    hypotheses: [hypothesis({ evidenceAgainstIds: ["ev-conflict"] })],
  });
  assert.equal(conflicted[0]?.resolutionState, "CONFLICTED_EVIDENCE");

  const competing = planDivergenceEvidenceRecruitment({
    divergences: [divergence()],
    beliefs: [belief()],
    hypotheses: [
      hypothesis(),
      hypothesis({ id: "hyp-alt", confidence: 74 }),
    ],
  });
  assert.equal(competing[0]?.resolutionState, "COMPETING_HYPOTHESES");

  const resolved = planDivergenceEvidenceRecruitment({
    divergences: [divergence()],
    beliefs: [belief()],
    hypotheses: [hypothesis()],
  });
  assert.deepEqual(resolved, []);

  const immaterial = planDivergenceEvidenceRecruitment({
    divergences: [divergence({ magnitude: 49, persistenceScore: 64 })],
    beliefs: [belief()],
    hypotheses: [],
  });
  assert.deepEqual(immaterial, []);
});

test("P2.2 rates recruitment is bounded and sequential", () => {
  const plans = planDivergenceEvidenceRecruitment({
    divergences: [divergence()],
    beliefs: [belief()],
    hypotheses: [],
  });

  const plan = plans[0]!;
  assert.equal(plan.contractVersion, DIVERGENCE_EVIDENCE_RECRUITMENT_VERSION);
  assert.equal(plan.debtKey, "divergence:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(plan.severity, "high");
  assert.deepEqual(plan.evidenceNeeded, [
    "real yields and breakevens around the divergence window",
    "curve, term-premium or meeting-pricing context only if the first test remains unresolved",
  ]);
  assert.match(plan.nextAction, /^Recruit only real yields and breakevens/);
  assert.match(plan.nextAction, /if still unresolved, then recruit/);
  assert.ok(plan.evidenceNeeded.length <= 2);
});

test("P2.2 uses domain-specific minimum discriminator packs", () => {
  const cases = [
    {
      belief: belief({ id: "gold", affectedAssets: ["XAUUSD"], primaryCategory: "commodities", themes: ["gold"] }),
      divergence: divergence({ id: "gold-div", marketBeliefId: "gold" }),
      expected: /real yields, DXY and reaction timing/,
    },
    {
      belief: belief({ id: "oil", affectedAssets: ["WTI", "XLE"], primaryCategory: "energy", themes: ["oil"] }),
      divergence: divergence({ id: "oil-div", marketBeliefId: "oil" }),
      expected: /refined-product cracks/,
    },
    {
      belief: belief({ id: "equity", affectedAssets: ["SPX", "QQQ"], primaryCategory: "equities", themes: ["growth"] }),
      divergence: divergence({ id: "equity-div", marketBeliefId: "equity" }),
      expected: /VIX and index breadth/,
    },
    {
      belief: belief({ id: "fx", affectedAssets: ["EURUSD"], primaryCategory: "fx", themes: ["policy"] }),
      divergence: divergence({ id: "fx-div", marketBeliefId: "fx" }),
      expected: /rate differentials and policy repricing/,
    },
    {
      belief: belief({ id: "credit", affectedAssets: ["HYG"], primaryCategory: "credit", themes: ["funding"] }),
      divergence: divergence({ id: "credit-div", marketBeliefId: "credit" }),
      expected: /credit spreads and funding stress/,
    },
  ];

  for (const item of cases) {
    const plans = planDivergenceEvidenceRecruitment({
      divergences: [item.divergence],
      beliefs: [item.belief],
      hypotheses: [],
    });
    assert.equal(plans.length, 1);
    assert.match(plans[0]!.evidenceNeeded[0]!, item.expected);
    assert.ok(plans[0]!.evidenceNeeded.length <= 2);
  }
});

test("P2.2 caps one cycle at four unresolved divergence research debts", () => {
  const divergences = Array.from({ length: 7 }, (_, index) =>
    divergence({
      id: `div-${index}`,
      marketBeliefId: `belief-${index}`,
    }),
  );
  const beliefs = divergences.map((item, index) =>
    belief({
      id: item.marketBeliefId,
      affectedAssets: index % 2 ? ["XAUUSD"] : ["US10Y"],
    }),
  );

  const plans = planDivergenceEvidenceRecruitment({
    divergences,
    beliefs,
    hypotheses: [],
  });

  assert.equal(plans.length, 4);
});

test("P2.2 planner is pure and does not fetch, persist, or invoke a model", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const source = fs.readFileSync(
    path.join(root, "lib", "intelligence", "divergence-evidence-recruitment.ts"),
    "utf8",
  );

  assert.doesNotMatch(source, /fetch\(/);
  assert.doesNotMatch(source, /intelligenceRest|supabase/i);
  assert.doesNotMatch(source, /runStructuredStage|modelStage|openai/i);
});
