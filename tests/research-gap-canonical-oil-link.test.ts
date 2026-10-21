import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  canonicalOilPairAssessments, explicitOilResearchTradeDate,
  type VerifiedOilPairReceipt,
} from "../lib/research-gap-canonical-oil-link.ts";
import { evaluateResearchGapEvidence, type ResearchGapPlan, type ResearchGapEvidenceAssessment } from "../lib/research-gap-plan.ts";

const WTI: VerifiedOilPairReceipt = {
  evidenceId: "33c1af9e-567a-4662-8b4b-9300c016f97a",
  benchmark: "WTI", tradeDate: "2026-10-14",
  sourceUrl: "https://www.cmegroup.com/daily_bulletin/archive/20261014/Section61_Energy_Futures_Products.pdf",
  frontContract: "CLX26", nextContract: "CLZ26", frontSettle: 81.05, nextSettle: 80.65,
};
const BRENT: VerifiedOilPairReceipt = {
  evidenceId: "f7a1ff95-1bf5-41ad-b21b-6155c9f76eaa",
  benchmark: "BRENT", tradeDate: "2026-10-14",
  sourceUrl: "https://www.ice.com/report/2026-10-14/brent-settlements.csv",
  frontContract: "LCOZ26", nextContract: "LCOF27", frontSettle: 85.25, nextSettle: 84.85,
};
function plan(question: string, descriptions: string[] = ["Original dated WTI F1/F2 settlements"]): ResearchGapPlan {
  return {
    contractVersion: "research-gap-plan/1", planId: "plan-id", caseId: "case-id",
    gapKey: "canonical-oil-link-test",
    generatedAt: "2026-10-21T00:00:00Z",
    researchQuestion: question, priorExpectation: null,
    objective: question, subquestions: [question],
    requirements: descriptions.map((description,i) => ({
      id: "req:"+(i+1), description, required: true, preferredSourceClasses: ["market_data","official"],
    })),
    linkedInvestigationIds: [], linkedStoryIds: [], blockingRefs: [],
    budget: { maxSources: 8, maxBranches: 3, maxRequirements: 6 },
    stopPolicy: { minimumQuality: 65, strongQuality: 80, authoritativeQuality: 90,
      minimumIndependentStrongSources: 2, rules: [] },
  };
}
function web(): ResearchGapEvidenceAssessment {
  return {
    evidenceId: "gap-web:article-id", independenceKey: "exchange-page",
    sourceClass: "official", sourceUrl: WTI.sourceUrl,
    requirementIds: ["req:1"], direction: "CONFIRMING", directness: "DIRECT",
    quality: 99, traceable: true,
    claim: "CME explains how oil settles, but source has no verified canonical row.",
  };
}
test("requires one explicit and consistent trade date to link original sources", () => {
  const dated = plan("Is WTI backwardated on 14 October 2026?");
  assert.equal(explicitOilResearchTradeDate(dated), "2026-10-14");
  assert.equal(explicitOilResearchTradeDate(plan("WTI F1/F2 settlements for 2026-10-14")), "2026-10-14");
  assert.equal(explicitOilResearchTradeDate(plan("WTI F1/F2 as of today")), null);
  assert.equal(explicitOilResearchTradeDate(plan("WTI F1/F2 on 2026-10-14 and 2026-10-15")), null);
  assert.equal(explicitOilResearchTradeDate(plan("WTI settlements on 31 February 2026")), null);
});

test("new original Evidence UUID becomes eligible WITHOUT a model-supplied UUID", () => {
  const p = plan("Verify original WTI F1/F2 settlement values 2026-10-14");
  const model = web();
  const before = evaluateResearchGapEvidence({
    plan: p, evidence: [model], branchCount: 1,
    verifiedCanonicalOilEvidence: [{ evidenceId: WTI.evidenceId, benchmark: "WTI" }],
  });
  assert.equal(before.outcome, "UNRESOLVED",
    "Before auto-link the web citation cannot become an original exchange measurement");
  const joined = canonicalOilPairAssessments(p, [WTI]);
  assert.equal(joined.length, 1);
  assert.equal(joined[0].evidenceId, WTI.evidenceId);
  assert.equal(joined[0].sourceClass, "market_data");
  assert.equal(joined[0].requirementIds[0], "req:1");
  assert.match(joined[0].claim, /F1-F2 \$0\.4\/bbl/);
  const after = evaluateResearchGapEvidence({
    plan: p, evidence: [model, ...joined], branchCount: 1,
    verifiedCanonicalOilEvidence: [{ evidenceId: WTI.evidenceId, benchmark: "WTI" }],
  });
  assert.equal(after.outcome, "CONFIRMING");
  assert.equal(after.shouldStop, true);
  assert.deepEqual(after.eligibleEvidenceIds, [WTI.evidenceId]);
});

test("backwardation question direction follows verified two-leg arithmetic, not model opinion", () => {
  const p = plan("Is WTI in backwardation on 14 October 2026?");
  const positive = canonicalOilPairAssessments(p, [WTI]);
  assert.equal(positive[0].direction, "CONFIRMING");
  const neg = canonicalOilPairAssessments(p, [{...WTI, frontSettle: 79.10, nextSettle: 80.10}]);
  assert.equal(neg[0].direction, "CONTRADICTING");
  assert.match(neg[0].claim, /Contango/);
  assert.deepEqual(canonicalOilPairAssessments(p, [{...WTI, tradeDate:"2026-10-15"}]), []);
});

test("joint WTI / ICE Brent requires independent exact records for both", () => {
  const p = plan("Compare original WTI and Brent F1/F2 settlements on 14 October 2026",
    ["Exact WTI F1/F2 settlements", "Exact Brent F1/F2 settlements"]);
  const one = canonicalOilPairAssessments(p, [WTI]);
  const oneOutcome = evaluateResearchGapEvidence({
    plan: p, evidence: one, branchCount: 1,
    verifiedCanonicalOilEvidence: [{ evidenceId: WTI.evidenceId, benchmark: "WTI" }],
  });
  assert.equal(oneOutcome.shouldStop, false);
  assert.equal(oneOutcome.missingRequirementIds.length, 2,
    "Joint oil question is fail-closed: neither leg is eligible until both exchanges are verified");
  const both = canonicalOilPairAssessments(p, [WTI,BRENT]);
  assert.equal(both.length, 2);
  assert.deepEqual(both[0].requirementIds, ["req:1"]);
  assert.deepEqual(both[1].requirementIds, ["req:2"]);
  const complete = evaluateResearchGapEvidence({
    plan: p, evidence: both, branchCount: 1,
    verifiedCanonicalOilEvidence: [
      { evidenceId: WTI.evidenceId, benchmark: "WTI" },
      { evidenceId: BRENT.evidenceId, benchmark: "BRENT" },
    ],
  });
  assert.equal(complete.outcome, "CONFIRMING");
  assert.equal(complete.shouldStop, true);
});

test("unrelated research requirements remain explicitly uncovered", () => {
  const p = plan("WTI F1/F2 original settlements on 14 October 2026",
    ["Exact WTI F1/F2 original settlements", "EIA distillate inventory on 14 October 2026"]);
  const joined = canonicalOilPairAssessments(p,[WTI]);
  assert.deepEqual(joined[0].requirementIds, ["req:1"]);
  const result = evaluateResearchGapEvidence({
    plan: p, evidence: joined, branchCount: 1,
    verifiedCanonicalOilEvidence: [{ evidenceId: WTI.evidenceId, benchmark: "WTI" }],
  });
  assert.equal(result.shouldStop, false);
  assert.deepEqual(result.missingRequirementIds, ["req:2"]);
});

test("live route queries ONLY trade-date-stamped canonical receipts and reuses full archive proof", () => {
  const s = readFileSync(new URL("../app/api/research-gap/execution/route.ts", import.meta.url), "utf8");
  assert.match(s, /explicitOilResearchTradeDate\(gap\.research_plan\)/);
  assert.match(s, /contains\("structured_payload", \{ signalKind: "official_futures_settlement_pair" \}\)/);
  assert.match(s, /verifiedCanonicalOilPair\(proof, benchmark, new Date\(\)\)/);
  assert.match(s, /canonicalOilPairAssessments\(\s*gap\.research_plan, sourceVerifiedOilReceipts\)/);
  assert.match(s, /const evaluatedEvidence = \[\.\.\.modelEvidence, \.\.\.automaticallyLinkedOil\]/);
  assert.doesNotMatch(s, /from\("story_thesis_versions"\)/);
});
