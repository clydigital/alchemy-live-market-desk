import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildAutomaticResearchGapRun,
  type CompletedResearchGapResult,
} from "../lib/research-gap-auto-handoff.ts";
import {
  attachResearchGapHandoffToItems,
  parseResearchGapHandoffContext,
} from "../lib/research-gap-handoff.ts";

function completedDivergenceGap(): CompletedResearchGapResult {
  return {
    gateRunId: "p2-3-divergence-return-proof",
    gapId: "divergence:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    affectedStorySlugs: ["rates-duration-stress"],
    researchQuestion: "Did real yields explain the canonical divergence?",
    priorExpectation: "Softer inflation should lower long-end yields.",
    finding: "The official real-yield series fell during the divergence window.",
    confidence: 88,
    outcome: "CONFIRMING",
    remainsUnknown: [],
    liveImplication: "Real-yield transmission now has direct canonical support.",
    nextTest: "Check whether the real-yield move persists into the next session.",
    completedAt: "2026-10-05T06:00:00.000Z",
    evidence: [{
      sourceId: "fred-dfii10",
      itemType: "news",
      publisher: "Federal Reserve Bank of St. Louis",
      title: "10-Year Treasury Inflation-Indexed Security, Constant Maturity",
      url: "https://fred.stlouisfed.org/series/DFII10",
      publishedAt: "2026-10-05T05:30:00.000Z",
      claim: "The 10-year real yield fell during the measured divergence window.",
      summary: "Official real-yield evidence for the divergence discriminator.",
      sourceQuality: 100,
      relevance: 100,
      novelty: 85,
      materiality: 92,
    }],
  };
}

test("P2.3 divergence evidence returns through canonical Research Gap intake", () => {
  const run = buildAutomaticResearchGapRun(completedDivergenceGap());

  assert.equal(
    run.runKey,
    "gap-gate:p2-3-divergence-return-proof:divergence:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );
  assert.equal(run.items.length, 1);
  assert.equal(run.items[0]?.recommendedAction, "collect_evidence");
  assert.equal(run.handoff?.gapId, "divergence:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

  assert.ok(run.handoff);
  const [attached] = attachResearchGapHandoffToItems(run.handoff, run.items);
  const context = parseResearchGapHandoffContext(attached?.divergenceNote);

  assert.equal(context?.kind, "research_gap_gate");
  assert.equal(context?.gapId, "divergence:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(
    context?.finding,
    "The official real-yield series fell during the divergence window.",
  );
  assert.deepEqual(context?.affectedStorySlugs, ["rates-duration-stress"]);
});

test("P2.3 canonical runtime admits returned Gap evidence before downstream reasoning", () => {
  const runtime = readFileSync(
    new URL("../lib/intelligence/runtime.ts", import.meta.url),
    "utf8",
  );

  const parseAt = runtime.indexOf(
    "const gapHandoff = parseResearchGapHandoffContext(item.divergence_note)",
  );
  const evidenceNatureAt = runtime.indexOf(
    'evidenceNature: gapHandoff ? "research_gap_handoff"',
    parseAt,
  );
  const canonicalUpsertAt = runtime.indexOf(
    '"intelligence_evidence?on_conflict=source_id,content_hash"',
    evidenceNatureAt,
  );
  const canonicalIdsAt = runtime.indexOf(
    "return canonicalEvidence.map((evidence) => evidence.id)",
    canonicalUpsertAt,
  );
  const intakeAt = runtime.indexOf("const canonicalisedEvidenceIds = await canonicaliseIntake(stories)");
  const requiredAt = runtime.indexOf("const requiredEvidenceIds = unique([", intakeAt);
  const loadAt = runtime.indexOf("const evidence = await loadEvidence(requiredEvidenceIds)", requiredAt);

  assert.ok(parseAt >= 0, "Research Gap handoff context must be parsed from returned intake.");
  assert.ok(evidenceNatureAt > parseAt, "Returned Gap evidence must retain its canonical handoff nature.");
  assert.ok(canonicalUpsertAt > evidenceNatureAt, "Returned Gap evidence must enter intelligence_evidence.");
  assert.ok(canonicalIdsAt > canonicalUpsertAt, "Canonical Evidence UUIDs must be returned by intake.");
  assert.ok(intakeAt >= 0 && requiredAt > intakeAt && loadAt > requiredAt);
  assert.match(
    runtime.slice(requiredAt, loadAt),
    /\.\.\.canonicalisedEvidenceIds/,
  );
});

test("P2.3 return-path proof adds no direct Story, Regime or Presenter mutation bypass", () => {
  const handoff = readFileSync(
    new URL("../lib/research-gap-auto-handoff.ts", import.meta.url),
    "utf8",
  );

  assert.match(handoff, /recommendedAction: "collect_evidence"/);
  assert.doesNotMatch(handoff, /persistCanonicalStoryReasoning|apply_intelligence_story_assessment_v2/);
  assert.doesNotMatch(handoff, /persistRegime|projectRegime|PresenterDivergenceJourney/);
});
