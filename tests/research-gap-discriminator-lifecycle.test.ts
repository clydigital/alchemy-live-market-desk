import assert from "node:assert/strict";
import test from "node:test";

import {
  decideResearchGapDiscriminatorLifecycle,
  RESEARCH_GAP_DISCRIMINATOR_LIFECYCLE_VERSION,
  type ResearchGapDiscriminatorLifecycleSnapshot,
} from "../lib/research-gap-discriminator-lifecycle.ts";
import type { ResearchGapCausalDiscriminatorPlan } from "../lib/research-gap-worker.ts";

function plan(
  signature = "plan-a",
  discriminators = ["test-one", "test-two"],
): ResearchGapCausalDiscriminatorPlan {
  return {
    contractVersion: "research-gap-causal-discriminator/1",
    planSignature: signature,
    baseEvidenceNeeded: ["MOVE", "HY spreads"],
    discriminators,
  };
}

function prior(
  activeIndex = 0,
  signature = "plan-a",
): ResearchGapDiscriminatorLifecycleSnapshot {
  const discriminators = ["test-one", "test-two"];
  return {
    contractVersion: RESEARCH_GAP_DISCRIMINATOR_LIFECYCLE_VERSION,
    planSignature: signature,
    baseEvidenceNeeded: ["MOVE", "HY spreads"],
    discriminators,
    activeIndex,
    activeDiscriminator: discriminators[activeIndex]!,
  };
}

test("P2b starts new work at discriminator #1 only", () => {
  const decision = decideResearchGapDiscriminatorLifecycle({
    candidatePlan: plan(),
  });

  assert.equal(decision.transition, "INITIAL");
  assert.equal(decision.lifecycle.activeIndex, 0);
  assert.equal(decision.lifecycle.activeDiscriminator, "test-one");
  assert.deepEqual(decision.evidenceNeeded, ["MOVE", "HY spreads", "test-one"]);
  assert.equal(decision.shouldRequeue, false);
});

test("P2b handed-off work cannot advance without exact canonical admission", () => {
  const decision = decideResearchGapDiscriminatorLifecycle({
    candidatePlan: plan(),
    existingStatus: "HANDED_OFF",
    priorLifecycle: prior(0),
    canonicalHandoffAdmitted: false,
  });

  assert.equal(decision.transition, "PRESERVE");
  assert.equal(decision.lifecycle.activeIndex, 0);
  assert.equal(decision.shouldRequeue, false);
});

test("P2b exact canonical admission advances exactly one discriminator", () => {
  const decision = decideResearchGapDiscriminatorLifecycle({
    candidatePlan: plan(),
    existingStatus: "HANDED_OFF",
    priorLifecycle: prior(0),
    canonicalHandoffAdmitted: true,
  });

  assert.equal(decision.transition, "ADVANCE");
  assert.equal(decision.lifecycle.activeIndex, 1);
  assert.equal(decision.lifecycle.activeDiscriminator, "test-two");
  assert.equal(decision.shouldRequeue, true);
  assert.equal(decision.shouldClose, false);
});

test("P2b exhausts after the final bounded discriminator", () => {
  const decision = decideResearchGapDiscriminatorLifecycle({
    candidatePlan: plan(),
    existingStatus: "HANDED_OFF",
    priorLifecycle: prior(1),
    canonicalHandoffAdmitted: true,
  });

  assert.equal(decision.transition, "EXHAUST");
  assert.equal(decision.shouldClose, true);
  assert.equal(decision.shouldRequeue, false);
});

test("P2b same-plan closed work stays closed", () => {
  const decision = decideResearchGapDiscriminatorLifecycle({
    candidatePlan: plan(),
    existingStatus: "CLOSED",
    priorLifecycle: prior(1),
  });

  assert.equal(decision.transition, "EXHAUST");
  assert.equal(decision.shouldClose, true);
});

test("P2b changed plan may reopen from discriminator #1", () => {
  const decision = decideResearchGapDiscriminatorLifecycle({
    candidatePlan: plan("plan-b", ["new-test-one", "new-test-two"]),
    existingStatus: "CLOSED",
    priorLifecycle: prior(1, "plan-a"),
  });

  assert.equal(decision.transition, "REOPEN_CHANGED_PLAN");
  assert.equal(decision.lifecycle.activeIndex, 0);
  assert.equal(decision.lifecycle.activeDiscriminator, "new-test-one");
  assert.equal(decision.shouldRequeue, true);
});

test("P2b in-flight work preserves its frozen discriminator", () => {
  const decision = decideResearchGapDiscriminatorLifecycle({
    candidatePlan: plan("plan-b", ["new-test-one", "new-test-two"]),
    existingStatus: "RESEARCHING",
    priorLifecycle: prior(0, "plan-a"),
  });

  assert.equal(decision.transition, "PRESERVE");
  assert.equal(decision.lifecycle.planSignature, "plan-a");
  assert.equal(decision.lifecycle.activeDiscriminator, "test-one");
});
