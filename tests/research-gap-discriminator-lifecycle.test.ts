import assert from "node:assert/strict";
import test from "node:test";

import {
  decideResearchGapDiscriminatorLifecycle,
  researchGapDiscriminatorLifecycleFromPlan,
  selectResearchGapDiscriminatorLifecycleSource,
} from "../lib/research-gap-discriminator-lifecycle.ts";
import type { ResearchGapCausalDiscriminatorPlan } from "../lib/research-gap-worker.ts";

function plan(
  signature = "plan-a",
  discriminators = ["test first mechanism", "test second mechanism"],
): ResearchGapCausalDiscriminatorPlan {
  return {
    contractVersion: "research-gap-causal-discriminator/1",
    planSignature: signature,
    baseEvidenceNeeded: ["base evidence"],
    discriminators,
  };
}

function frozen(
  signature = "plan-a",
  activeIndex = 0,
  discriminators = ["test first mechanism", "test second mechanism"],
) {
  return {
    causalDiscriminator: {
      contractVersion: "research-gap-discriminator-lifecycle/1",
      planSignature: signature,
      baseEvidenceNeeded: ["base evidence"],
      discriminators,
      activeIndex,
      activeDiscriminator: discriminators[activeIndex],
    },
  };
}

test("new causal discriminator work starts at the first bounded test", () => {
  const result = decideResearchGapDiscriminatorLifecycle({
    candidatePlan: plan(),
  });

  assert.equal(result.transition, "INITIAL");
  assert.equal(result.lifecycle.activeIndex, 0);
  assert.equal(result.lifecycle.activeDiscriminator, "test first mechanism");
  assert.deepEqual(result.evidenceNeeded, [
    "base evidence",
    "test first mechanism",
  ]);
  assert.equal(result.shouldRequeue, false);
  assert.equal(result.shouldClose, false);
});

test("queued replay preserves the exact frozen active discriminator", () => {
  const result = decideResearchGapDiscriminatorLifecycle({
    candidatePlan: plan(),
    existingStatus: "QUEUED",
    existingResearchPlan: frozen("plan-a", 0),
  });

  assert.equal(result.transition, "PRESERVE");
  assert.equal(result.lifecycle.activeIndex, 0);
  assert.equal(result.shouldRequeue, false);
});

test("queued carry-forward uses the latest occurrence when requeue cleared the worker plan", () => {
  const occurrence = frozen("plan-a", 1);
  const source = selectResearchGapDiscriminatorLifecycleSource({
    existingResearchPlan: null,
    latestOccurrenceSnapshot: occurrence,
  });

  const result = decideResearchGapDiscriminatorLifecycle({
    candidatePlan: plan(),
    existingStatus: "QUEUED",
    existingResearchPlan: source,
  });

  assert.equal(result.transition, "PRESERVE");
  assert.equal(result.lifecycle.activeIndex, 1);
  assert.equal(result.lifecycle.activeDiscriminator, "test second mechanism");
});

test("occurrence fallback preserves monotonic progress within the latest plan signature", () => {
  const source = selectResearchGapDiscriminatorLifecycleSource({
    existingResearchPlan: null,
    occurrenceSnapshots: [
      frozen("plan-a", 0),
      frozen("plan-a", 1),
      frozen("plan-a", 0),
    ],
  });

  assert.equal(
    researchGapDiscriminatorLifecycleFromPlan(source)?.activeIndex,
    1,
  );
});

test("a newer changed plan may legitimately restart at discriminator zero", () => {
  const source = selectResearchGapDiscriminatorLifecycleSource({
    existingResearchPlan: null,
    occurrenceSnapshots: [
      frozen("plan-b", 0, ["new first", "new second"]),
      frozen("plan-a", 1),
    ],
  });

  const lifecycle = researchGapDiscriminatorLifecycleFromPlan(source);
  assert.equal(lifecycle?.planSignature, "plan-b");
  assert.equal(lifecycle?.activeIndex, 0);
});

test("active worker plan remains authoritative over an older occurrence snapshot", () => {
  const workerPlan = frozen("plan-a", 1);
  const source = selectResearchGapDiscriminatorLifecycleSource({
    existingResearchPlan: workerPlan,
    latestOccurrenceSnapshot: frozen("plan-a", 0),
  });

  assert.equal(source, workerPlan);
  assert.equal(
    researchGapDiscriminatorLifecycleFromPlan(source)?.activeIndex,
    1,
  );
});

test("malformed worker lifecycle falls back to a valid append-only occurrence", () => {
  const source = selectResearchGapDiscriminatorLifecycleSource({
    existingResearchPlan: {
      causalDiscriminator: {
        contractVersion: "research-gap-discriminator-lifecycle/1",
        planSignature: "plan-a",
        baseEvidenceNeeded: [],
        discriminators: ["one", "two"],
        activeIndex: 1,
        activeDiscriminator: "one",
      },
    },
    latestOccurrenceSnapshot: frozen("plan-a", 1),
  });

  assert.equal(
    researchGapDiscriminatorLifecycleFromPlan(source)?.activeIndex,
    1,
  );
});

test("handed-off work cannot advance without exact canonical handoff admission", () => {
  const result = decideResearchGapDiscriminatorLifecycle({
    candidatePlan: plan(),
    existingStatus: "HANDED_OFF",
    existingResearchPlan: frozen("plan-a", 0),
    canonicalHandoffAdmitted: false,
  });

  assert.equal(result.transition, "PRESERVE");
  assert.equal(result.lifecycle.activeIndex, 0);
  assert.equal(result.shouldRequeue, false);
  assert.match(result.reason, /exact case UUID|canonical Evidence/i);
});

test("exact canonical handoff advances to the next discriminator", () => {
  const result = decideResearchGapDiscriminatorLifecycle({
    candidatePlan: plan(),
    existingStatus: "HANDED_OFF",
    existingResearchPlan: frozen("plan-a", 0),
    canonicalHandoffAdmitted: true,
  });

  assert.equal(result.transition, "ADVANCE");
  assert.equal(result.lifecycle.activeIndex, 1);
  assert.equal(result.lifecycle.activeDiscriminator, "test second mechanism");
  assert.deepEqual(result.evidenceNeeded, [
    "base evidence",
    "test second mechanism",
  ]);
  assert.equal(result.shouldRequeue, true);
  assert.equal(result.shouldClose, false);
});

test("final admitted discriminator exhausts the bounded plan instead of looping", () => {
  const result = decideResearchGapDiscriminatorLifecycle({
    candidatePlan: plan(),
    existingStatus: "HANDED_OFF",
    existingResearchPlan: frozen("plan-a", 1),
    canonicalHandoffAdmitted: true,
  });

  assert.equal(result.transition, "EXHAUST");
  assert.equal(result.lifecycle.activeIndex, 1);
  assert.equal(result.shouldRequeue, false);
  assert.equal(result.shouldClose, true);
});

test("closed exhausted work does not reopen on the same plan", () => {
  const result = decideResearchGapDiscriminatorLifecycle({
    candidatePlan: plan(),
    existingStatus: "CLOSED",
    existingResearchPlan: frozen("plan-a", 1),
  });

  assert.equal(result.transition, "EXHAUST");
  assert.equal(result.shouldClose, true);
  assert.equal(result.shouldRequeue, false);
});

test("a materially changed plan may reopen a closed case from discriminator zero", () => {
  const result = decideResearchGapDiscriminatorLifecycle({
    candidatePlan: plan("plan-b", ["new first test", "new second test"]),
    existingStatus: "CLOSED",
    existingResearchPlan: frozen("plan-a", 1),
  });

  assert.equal(result.transition, "REOPEN_CHANGED_PLAN");
  assert.equal(result.lifecycle.activeIndex, 0);
  assert.equal(result.lifecycle.activeDiscriminator, "new first test");
  assert.equal(result.shouldRequeue, true);
  assert.equal(result.shouldClose, false);
});

test("in-flight work preserves its frozen discriminator even if the current Dossier plan changed", () => {
  const result = decideResearchGapDiscriminatorLifecycle({
    candidatePlan: plan("plan-b", ["new first test", "new second test"]),
    existingStatus: "RESEARCHING",
    existingResearchPlan: frozen("plan-a", 0),
  });

  assert.equal(result.transition, "PRESERVE");
  assert.equal(result.lifecycle.planSignature, "plan-a");
  assert.equal(result.lifecycle.activeDiscriminator, "test first mechanism");
  assert.equal(result.shouldRequeue, false);
});

test("malformed frozen lifecycle fails closed instead of inferring progress", () => {
  assert.equal(
    researchGapDiscriminatorLifecycleFromPlan({
      causalDiscriminator: {
        contractVersion: "research-gap-discriminator-lifecycle/1",
        planSignature: "plan-a",
        baseEvidenceNeeded: ["base evidence"],
        discriminators: ["one", "two"],
        activeIndex: 1,
        activeDiscriminator: "one",
      },
    }),
    null,
  );
});
