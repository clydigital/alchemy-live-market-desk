import assert from "node:assert/strict";
import test from "node:test";

import {
  planDivergenceRecruitmentLifecycle,
  type DivergenceRecruitmentDebtState,
  type DivergenceRecruitmentHandoffCase,
} from "../lib/intelligence/divergence-recruitment-lifecycle.ts";
import {
  planDivergenceEvidenceRecruitment,
  type DivergenceEvidenceRecruitment,
} from "../lib/intelligence/divergence-evidence-recruitment.ts";

const DEBT_KEY = "divergence:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function currentPlan(): DivergenceEvidenceRecruitment {
  return planDivergenceEvidenceRecruitment({
    divergences: [{
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      marketBeliefId: "belief-rates",
      observedChange: "US10Y stayed elevated.",
      expectedChange: "Long-end yields should ease.",
      magnitude: 82,
      persistenceScore: 76,
    }],
    beliefs: [{
      id: "belief-rates",
      statement: "Long-end rates should ease after softer inflation.",
      affectedAssets: ["US10Y"],
      primaryCategory: "rates",
      themes: ["duration"],
    }],
    hypotheses: [],
  })[0]!;
}

function debt(
  overrides: Partial<DivergenceRecruitmentDebtState> = {},
): DivergenceRecruitmentDebtState {
  const plan = currentPlan();
  return {
    id: "debt-rates",
    debtKey: DEBT_KEY,
    status: "open",
    metadata: {
      kind: "canonical_divergence_recruitment",
      planSignature: plan.planSignature,
      activeEvidenceIndex: 0,
      activeEvidenceNeeded: [plan.evidenceNeeded[0]],
      remainingEvidenceNeeded: [plan.evidenceNeeded[1]],
      processedCaseIds: [],
    },
    ...overrides,
  };
}

function handoff(
  overrides: Partial<DivergenceRecruitmentHandoffCase> = {},
): DivergenceRecruitmentHandoffCase {
  const plan = currentPlan();
  return {
    id: "case-first",
    sourceRef: DEBT_KEY,
    status: "HANDED_OFF",
    handedOffAt: "2026-10-05T06:00:00.000Z",
    evidenceNeeded: [plan.evidenceNeeded[0]!],
    ...overrides,
  };
}

test("P2.4 resolves open divergence debt only after its handoff is canonical and the current plan disappears", () => {
  const actions = planDivergenceRecruitmentLifecycle({
    debts: [debt()],
    handoffCases: [handoff()],
    canonicalHandoffCaseIds: new Set(["case-first"]),
    currentPlans: [],
  });

  assert.equal(actions.length, 1);
  assert.equal(actions[0]?.kind, "RESOLVE");
  if (actions[0]?.kind !== "RESOLVE") return;
  assert.equal(actions[0].terminalState, "RESOLVED_BY_CANONICAL_EVIDENCE");
  assert.deepEqual(actions[0].processedCaseIds, ["case-first"]);
});

test("P2.4 does not close or advance before the handoff appears in canonical evidence", () => {
  const actions = planDivergenceRecruitmentLifecycle({
    debts: [debt()],
    handoffCases: [handoff()],
    canonicalHandoffCaseIds: new Set(),
    currentPlans: [currentPlan()],
  });

  assert.deepEqual(actions, []);
});

test("P2.4 advances from first to second discriminator when canonical evidence returns but mechanism remains unresolved", () => {
  const plan = currentPlan();
  const actions = planDivergenceRecruitmentLifecycle({
    debts: [debt()],
    handoffCases: [handoff()],
    canonicalHandoffCaseIds: new Set(["case-first"]),
    currentPlans: [plan],
  });

  assert.equal(actions.length, 1);
  assert.equal(actions[0]?.kind, "ADVANCE");
  if (actions[0]?.kind !== "ADVANCE") return;
  assert.equal(actions[0].activeEvidenceIndex, 1);
  assert.deepEqual(actions[0].activeEvidenceNeeded, [plan.evidenceNeeded[1]]);
  assert.deepEqual(actions[0].remainingEvidenceNeeded, []);
  assert.match(actions[0].nextAction, /final bounded discriminator/i);
});

test("P2.4 exhausts the unchanged plan after the final canonical discriminator returns unresolved", () => {
  const plan = currentPlan();
  const advancedDebt = debt({
    metadata: {
      ...debt().metadata,
      activeEvidenceIndex: 1,
      activeEvidenceNeeded: [plan.evidenceNeeded[1]],
      remainingEvidenceNeeded: [],
      processedCaseIds: ["case-first"],
    },
  });
  const second = handoff({
    id: "case-second",
    handedOffAt: "2026-10-05T07:00:00.000Z",
    evidenceNeeded: [plan.evidenceNeeded[1]!],
  });

  const actions = planDivergenceRecruitmentLifecycle({
    debts: [advancedDebt],
    handoffCases: [handoff(), second],
    canonicalHandoffCaseIds: new Set(["case-first", "case-second"]),
    currentPlans: [plan],
  });

  assert.equal(actions.length, 1);
  assert.equal(actions[0]?.kind, "EXHAUST");
  if (actions[0]?.kind !== "EXHAUST") return;
  assert.equal(actions[0].terminalState, "BOUNDED_EXHAUSTED");
  assert.equal(actions[0].terminalPlanSignature, plan.planSignature);
  assert.deepEqual(actions[0].processedCaseIds, ["case-first", "case-second"]);
});

test("P2.4 ignores already processed, wrong-source and wrong-discriminator handoffs", () => {
  const plan = currentPlan();
  const state = debt({
    metadata: {
      ...debt().metadata,
      processedCaseIds: ["case-first"],
    },
  });

  const actions = planDivergenceRecruitmentLifecycle({
    debts: [state],
    handoffCases: [
      handoff(),
      handoff({ id: "wrong-source", sourceRef: "divergence:other" }),
      handoff({ id: "wrong-need", evidenceNeeded: [plan.evidenceNeeded[1]!] }),
    ],
    canonicalHandoffCaseIds: new Set(["case-first", "wrong-source", "wrong-need"]),
    currentPlans: [plan],
  });

  assert.deepEqual(actions, []);
});

test("P2.4 does not advance stale handoff evidence across a changed recruitment plan signature", () => {
  const plan = currentPlan();
  const staleDebt = debt({
    metadata: {
      ...debt().metadata,
      planSignature: "older-plan-signature",
    },
  });

  const actions = planDivergenceRecruitmentLifecycle({
    debts: [staleDebt],
    handoffCases: [handoff()],
    canonicalHandoffCaseIds: new Set(["case-first"]),
    currentPlans: [plan],
  });

  assert.deepEqual(actions, []);
});
