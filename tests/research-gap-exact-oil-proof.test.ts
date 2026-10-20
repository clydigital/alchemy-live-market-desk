import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  requiresExactOilPairProof,
  verifiedCanonicalOilPair,
  type CanonicalOilProofInput,
} from "../lib/research-gap-exact-oil-proof.ts";
import {
  evaluateResearchGapEvidence, type ResearchGapPlan, type ResearchGapEvidenceAssessment,
} from "../lib/research-gap-plan.ts";

const EVIDENCE = "6a9b8a89-089b-4bda-8c33-2fd272b4c65a";
const OBSERVATION = "7a9b8a89-089b-4bda-8c33-2fd272b4c65a";
const RAW = "8a9b8a89-089b-4bda-8c33-2fd272b4c65a";
const SOURCE = "9a9b8a89-089b-4bda-8c33-2fd272b4c65a";
const SOURCE_URL = "https://www.cmegroup.com/daily_bulletin/archive/20261014/Section61_Energy_Futures_Products.pdf";
const T = new Date("2026-10-21T03:00:00Z");
const HASH = "a".repeat(64);

function proof(): CanonicalOilProofInput {
  return {
    evidence: {
      id: EVIDENCE, normalised_observation_id: OBSERVATION, source_id: SOURCE,
      measurement_unit: "USD_per_barrel",
      event_at: "2026-10-14T00:00:00Z", available_at: "2026-10-20T20:00:00Z",
      affected_assets: ["WTI", "CLX26", "CLZ26"], provenance_urls: [SOURCE_URL],
      structured_payload: { signalKind: "official_futures_settlement_pair" },
    },
    observation: {
      id: OBSERVATION, raw_record_id: RAW,
      value: {
        benchmark: "WTI", exchange: "NYMEX", tradeDate: "2026-10-14",
        frontContract: "CLX26", nextContract: "CLZ26",
        frontSettle: 101.12, nextSettle: 99.12,
        final: true, unit: "USD_per_barrel", originalSourceSha256: HASH,
      },
    },
    raw: {
      id: RAW, source_url: SOURCE_URL, content_type: "application/pdf",
      content_hash: HASH, provider: "OIL_ORIGINAL",
      payload: {
        contractVersion: "oil-original-archive/1", benchmark: "WTI",
        provider: "CME", tradeDate: "2026-10-14", originalSourceSha256: HASH,
        archiveBucket: "alchemy-oil-originals-private",
        archivePath: "CME/2026-10-14/" + HASH + ".pdf",
        archiveVerified: true, canonicalAdmitted: false, sourceUrl: SOURCE_URL,
      },
    },
    source: { id: SOURCE, source_tier: 1, source_url: SOURCE_URL },
  };
}
function plan(question = "Retrieve WTI original F1/F2 settlement pair"): ResearchGapPlan {
  return {
    contractVersion: "research-gap-plan/1", planId: "p", caseId: "c", gapKey: "g",
    generatedAt: "2026-10-21T02:00:00Z",
    researchQuestion: question, priorExpectation: null,
    objective: question, subquestions: [question],
    requirements: [{ id: "req:1:oil", description: "Exact original WTI F1/F2 settles",
      required: true, preferredSourceClasses: ["official", "market_data"] }],
    linkedInvestigationIds: [], linkedStoryIds: [], blockingRefs: [],
    budget: { maxSources: 8, maxBranches: 3, maxRequirements: 6 },
    stopPolicy: { minimumQuality: 65, strongQuality: 80, authoritativeQuality: 90,
      minimumIndependentStrongSources: 2, rules: [] },
  };
}
function assessed(id: string): ResearchGapEvidenceAssessment {
  return {
    evidenceId: id, independenceKey: "cme.com",
    sourceClass: "official", sourceUrl: SOURCE_URL, requirementIds: ["req:1:oil"],
    direction: "CONFIRMING", directness: "DIRECT", quality: 99,
    traceable: true, claim: "An alleged original WTI F1/F2 settle.",
  };
}

test("exact oil lookup triggers for dated spreads, not generic oil education", () => {
  assert.deepEqual(requiresExactOilPairProof("WTI exact F1/F2 settlements", []), ["WTI"]);
  assert.deepEqual(requiresExactOilPairProof("Is Brent in backwardation?", []), ["BRENT"]);
  assert.deepEqual(requiresExactOilPairProof("Compare WTI and Brent forward curve", []), ["WTI", "BRENT"]);
  assert.deepEqual(requiresExactOilPairProof("What explains 2026 oil demand?", []), []);
  assert.deepEqual(requiresExactOilPairProof("How can I license an ICE account?", []), []);
});

test("server-side source joins, archive hash, date, exchange and numeric F1/F2 are mandatory", () => {
  assert.equal(verifiedCanonicalOilPair(proof(), "WTI", T), true);
  assert.equal(verifiedCanonicalOilPair(proof(), "BRENT", T), false);
  const broken: Array<[string, CanonicalOilProofInput]> = [
    ["no normalised observation", { ...proof(), evidence: { ...proof().evidence, normalised_observation_id: null } }],
    ["missing original archive hash", { ...proof(), raw: { ...proof().raw, content_hash: null } }],
    ["no private archive receipt", { ...proof(), raw: { ...proof().raw, payload: null } }],
    ["unverified archived bytes", { ...proof(), raw: { ...proof().raw, payload: { ...proof().raw.payload, archiveVerified: false } } }],
    ["wrong private bucket", { ...proof(), raw: { ...proof().raw, payload: { ...proof().raw.payload, archiveBucket: "public-assets" } } }],
    ["mismatched storage path", { ...proof(), raw: { ...proof().raw, payload: { ...proof().raw.payload, archivePath: "CME/2026-10-15/" + HASH + ".pdf" } } }],
    ["wrong source publisher", { ...proof(), raw: { ...proof().raw, provider: "WEB_SCRAPER" } }],
    ["mismatched archived source url", { ...proof(), raw: { ...proof().raw, payload: { ...proof().raw.payload, sourceUrl: "https://example.com/other.pdf" } } }],
    ["wrong archive contract version", { ...proof(), raw: { ...proof().raw, payload: { ...proof().raw.payload, contractVersion: "oil-original-archive/0" } } }],
    ["not a dated publisher URL", { ...proof(), raw: { ...proof().raw, source_url: "https://www.cmegroup.com/daily_bulletin/archive/other/Section61_Energy_Futures_Products.pdf" } }],

    ["mismatched raw file hash", { ...proof(), observation: { ...proof().observation, value: { ...proof().observation.value, originalSourceSha256: "b".repeat(64) } } }],
    ["rolling current PDF", { ...proof(), raw: { ...proof().raw, source_url: "https://www.cmegroup.com/daily_bulletin/current/Section61_Energy_Futures_Products.pdf" } }],
    ["unverified web cite", { ...proof(), evidence: { ...proof().evidence, id: "gap-web:some-hash" } }],
    ["third-party source tier", { ...proof(), source: { ...proof().source, source_tier: 3 } }],
    ["wrong exchange", { ...proof(), observation: { ...proof().observation, value: { ...proof().observation.value, exchange: "ICE" } } }],
    ["no second contract", { ...proof(), observation: { ...proof().observation, value: { ...proof().observation.value, nextSettle: null } } }],
    ["non-adjacent month", { ...proof(), observation: { ...proof().observation, value: { ...proof().observation.value, nextContract: "CLF27" } } }],
    ["wrong event date", { ...proof(), observation: { ...proof().observation, value: { ...proof().observation.value, tradeDate: "2026-10-15" } } }],
    ["future availability", { ...proof(), evidence: { ...proof().evidence, available_at: "2026-10-22T01:00:00Z" } }],
    ["not final", { ...proof(), observation: { ...proof().observation, value: { ...proof().observation.value, final: false } } }],
  ];
  for (const [reason, candidate] of broken) {
    assert.equal(verifiedCanonicalOilPair(candidate, "WTI", T), false, reason);
  }
});

test("a high-scoring web search or unverified UUID cannot close the Research Gap", () => {
  const p = plan();
  const gapWeb = evaluateResearchGapEvidence({ plan: p, evidence: [assessed("gap-web:top-cme-result")],
    branchCount: 1, now: T });
  assert.equal(gapWeb.outcome, "UNRESOLVED");
  assert.equal(gapWeb.shouldStop, false);
  assert.equal(gapWeb.missingRequirementIds.length, 1);
  const forged = evaluateResearchGapEvidence({ plan: p, evidence: [assessed(EVIDENCE)],
    branchCount: 1, now: T });
  assert.equal(forged.shouldStop, false, "A UUID string by itself is not server-side proof");
  const verified = evaluateResearchGapEvidence({ plan: p, evidence: [assessed(EVIDENCE)],
    verifiedCanonicalOilEvidence: [{ evidenceId: EVIDENCE, benchmark: "WTI" }],
    branchCount: 1, now: T });
  assert.equal(verified.outcome, "CONFIRMING");
  assert.equal(verified.shouldStop, true);
});

test("mixed WTI/ICE Brent source gaps require both original exchange receipts", () => {
  const p = plan("Compare original dated WTI and Brent F1/F2 settlements");
  const wtiOnly = evaluateResearchGapEvidence({ plan: p, evidence: [assessed(EVIDENCE)],
    verifiedCanonicalOilEvidence: [{ evidenceId: EVIDENCE, benchmark: "WTI" }],
    branchCount: 1, now: T });
  assert.equal(wtiOnly.shouldStop, false);
  assert.equal(wtiOnly.missingRequirementIds.length, 1);
});

test("Research Gap route queries existing canonical evidence and original record before stop verdict", () => {
  const route = readFileSync(new URL("../app/api/research-gap/execution/route.ts", import.meta.url), "utf8");
  assert.match(route, /verifiedCanonicalOilPair\(proof, benchmark, new Date\(\)\)/);
  assert.match(route, /from\("intelligence_evidence"\)/);
  assert.match(route, /from\("normalised_observations"\)/);
  assert.match(route, /from\("raw_source_records"\)/);
  assert.match(route, /content_hash,provider,payload/);
  assert.match(route, /from\("intelligence_evidence_sources"\)/);
  assert.match(route, /verifiedCanonicalOilEvidence/);
  assert.doesNotMatch(route, /from\("story_thesis_versions"\)/);
});
