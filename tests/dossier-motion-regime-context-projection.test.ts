import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { DossierPresentationV1 } from "../lib/dossier-v2/presentation-adapter.ts";
import { materialProjectionSignature } from "../lib/regime-engine.ts";
import { buildRegimeProjection } from "../lib/regimes.ts";

function dossier(withContext: boolean): DossierPresentationV1 {
  return {
    dossierId: "11111111-1111-4111-8111-111111111111",
    asOf: "2026-10-06T00:00:00.000Z",
    motionRegimeContext: withContext
      ? [
          {
            motionId: "motion-rates-1",
            decision: "REFINE",
            regimeSlug: "global-cost-of-capital",
            storyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            conclusion: "Long-end pressure remains a funding constraint, but the causal channel is unresolved.",
            rationale: "Canonical evidence supports the narrower Regime implication.",
            nextTest: "Separate real yields from term premium.",
            canonicalEvidenceRefs: ["evidence-rates-1"],
            observedAt: "2026-10-05T23:05:00.000Z",
            versionNumber: 3,
          },
          {
            motionId: "motion-ai-1",
            decision: "ACCEPT",
            regimeSlug: "us-china-ai",
            storyId: null,
            conclusion: "AI infrastructure competition remains strategically material.",
            rationale: "Canonical evidence supports the Regime-level context.",
            nextTest: null,
            canonicalEvidenceRefs: ["evidence-ai-1"],
            observedAt: "2026-10-05T22:30:00.000Z",
            versionNumber: 2,
          },
        ]
      : [],
  } as unknown as DossierPresentationV1;
}

function projection(dossierValue: DossierPresentationV1) {
  return buildRegimeProjection({
    stories: [],
    events: [],
    versions: [],
    newsThreads: [],
    statements: [],
    dossier: dossierValue,
  });
}

test("C1.5a2 projects exact Dossier Motion only into its frozen Regime as non-state context", () => {
  const projected = projection(dossier(true));
  const rates = projected.find((item) => item.slug === "global-cost-of-capital");
  const ai = projected.find((item) => item.slug === "us-china-ai");
  const gold = projected.find((item) => item.slug === "gold-reserve-diversification");

  assert.ok(rates);
  assert.ok(ai);
  assert.ok(gold);

  assert.equal(rates.dossierContext?.length, 1);
  assert.deepEqual(rates.dossierContext?.[0], {
    id: "dossier-motion:11111111-1111-4111-8111-111111111111:motion-rates-1",
    title: "Long-end pressure remains a funding constraint, but the causal channel is unresolved.",
    detail: "Canonical evidence supports the narrower Regime implication.",
    timestamp: "2026-10-05T23:05:00.000Z",
    state: "context",
    sourceKind: "dossier_motion",
    verification: "dossier-system2:refine",
    storyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    storySlug: null,
    href: null,
    hybridHref: "/hybrid-output?regime=global-cost-of-capital",
  });
  assert.equal(rates.latestNode?.sourceKind, "dossier_motion");

  assert.equal(ai.dossierContext?.length, 1);
  assert.equal(ai.dossierContext?.[0]?.id.includes("motion-ai-1"), true);
  assert.deepEqual(gold.dossierContext, []);
});

test("C1.5a2 Dossier context cannot change material Regime state, confidence or signature", () => {
  const base = projection(dossier(false));
  const context = projection(dossier(true));

  for (const slug of ["global-cost-of-capital", "us-china-ai"] as const) {
    const before = base.find((item) => item.slug === slug);
    const after = context.find((item) => item.slug === slug);
    assert.ok(before);
    assert.ok(after);

    assert.equal(after.state, before.state);
    assert.equal(after.stateKind, before.stateKind);
    assert.equal(after.confidence, before.confidence);
    assert.deepEqual(
      materialProjectionSignature(after),
      materialProjectionSignature(before),
    );
  }
});

test("C1.5a2 Regime persistence manifest pins context identity without making it material", () => {
  const engine = readFileSync(
    new URL("../lib/regime-engine.ts", import.meta.url),
    "utf8",
  );

  assert.match(engine, /motionRegimeContext:/);
  assert.match(engine, /dossierMotionContextIds:/);
  assert.match(engine, /canonicalEvidenceRefs:/);
  assert.doesNotMatch(
    materialProjectionSignature.toString(),
    /dossierContext|dossier_motion|motionRegimeContext/,
  );
});
