import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { measuredOilCurveAssertionErrors, type VerifiedStoryOilPair } from "../lib/intelligence/oil-curve-story-gate.ts";

const BRENT_UUID = "0c969f5a-712e-4fba-9610-0b3780d2a1a8";
const EXACT_UUID = "6b6f7398-8981-4e6d-b56f-f405e03c2c67";
const AS_OF = "2026-10-21T10:49:36Z";
const RECEIPT: VerifiedStoryOilPair = {
  evidenceId: EXACT_UUID,
  benchmark: "BRENT",
  tradeDate: "2026-10-14",
  frontSettle: 75.6,
  nextSettle: 74.3,
};
function check(text: string, opts: {
  assets?: string[];
  evidenceIds?: string[];
  receipts?: VerifiedStoryOilPair[];
  asOf?: string;
} = {}) {
  return measuredOilCurveAssertionErrors({
    texts: [text],
    assets: opts.assets ?? ["BRENT", "WTI", "CRUDE_OIL"],
    evidenceIds: opts.evidenceIds ?? [BRENT_UUID],
    receipts: opts.receipts ?? [],
    asOf: opts.asOf ?? AS_OF,
  });
}

test("production v4 observed Brent premium is rejected: five context pages cannot prove final F1/F2", () => {
  const assertion = "Observed exchange-publisher pages plus an independent forward-curve print show a front/next premium in Brent.";
  assert.match(check(assertion).join(" "), /BRENT.*original FINAL F1\/F2/i);
  assert.ok(check("Brent backwardation is in place on 2026-10-14.").length);
  assert.ok(check("WTI is in contango on 2026-10-14.").length);
  assert.ok(check("Front-month backwardation sustains positive roll returns and weakens storage incentive.").length);
});

test("context-only reports, conditional countercases and unresolved downgrades are retained", () => {
  assert.deepEqual(check("If Brent final F1/F2 settlements confirm backwardation, storage incentives could weaken."), []);
  assert.deepEqual(check("Brent backwardation is unverified pending original 14 October FINAL settlement files."), []);
  assert.deepEqual(check("A third-party report claims Brent front/next premium but neither exchange file is archived."), []);
  assert.deepEqual(check("Brent front/next premium cannot be confirmed from ICE methodology pages."), []);
  assert.deepEqual(check("Brent may be backwardated, or the apparent spread may be a calendar technicality."), []);
  assert.deepEqual(check("Confidence was reduced from 81 to 50 because original prices are missing."), []);
});

test("receipt must be a cited exact canonical UUID, date matched and observed before assertion", () => {
  const statement = "Brent backwardation is established for 2026-10-14.";
  assert.deepEqual(check(statement, { evidenceIds: [EXACT_UUID], receipts: [RECEIPT] }), []);
  assert.ok(check(statement, { evidenceIds: [BRENT_UUID], receipts: [RECEIPT] }).length);
  assert.ok(check(statement, { evidenceIds: [EXACT_UUID], receipts: [{ ...RECEIPT, benchmark: "WTI" }] }).length);
  assert.ok(check("Brent backwardation is established for 2026-10-15.", { evidenceIds: [EXACT_UUID], receipts: [RECEIPT] }).length);
  assert.ok(check("Brent backwardation is established.", { evidenceIds: [EXACT_UUID], receipts: [RECEIPT] }).length,
    "An old settle cannot establish an undated current curve.");
  assert.ok(check(statement, { evidenceIds: [EXACT_UUID], receipts: [{ ...RECEIPT, frontSettle: 74.0, nextSettle: 75.6 }] }).length);
  assert.deepEqual(check("Brent contango was established for 2026-10-14.", {
    evidenceIds: [EXACT_UUID], receipts: [{ ...RECEIPT, frontSettle: 74.0, nextSettle: 75.6 }],
  }), []);
});

test("verified legs compute numeric spreads; a copied or invented number fails", () => {
  assert.deepEqual(check("Brent F1-F2 spread of $1.30 on 2026-10-14.", {
    evidenceIds: [EXACT_UUID], receipts: [RECEIPT],
  }), []);
  assert.ok(check("Brent F1-F2 spread of $2.50 on 2026-10-14.", {
    evidenceIds: [EXACT_UUID], receipts: [RECEIPT],
  }).length);
  assert.ok(check("Brent F1-F2 spread of $1.30 on 2026-10-14. WTI is backwardated.", {
    evidenceIds: [EXACT_UUID], receipts: [RECEIPT],
  }).length);
});

test("both existing Story mutation routes use the source-chain gate before persistence", () => {
  const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");
  const verifier = readFileSync(new URL("../lib/intelligence/oil-curve-story-gate.ts", import.meta.url), "utf8");
  assert.match(runtime, /const oilCurveErrors = assessment\.disposition !== "unchanged"/);
  assert.match(runtime, /const materialAllowed = evidenceMaterialAllowed && !legacyReasoningGapBlocked && oilCurveErrors\.length === 0/);
  assert.match(runtime, /throw new Error\("Canonical Oil Story measurement gate:/);
  assert.ok(runtime.indexOf("const oilCurveErrors = await oilCurveMutationErrors({\n          texts: [\n            normalized.title")
    < runtime.indexOf("candidates.push(normalized)"));
  assert.match(verifier, /verifiedCanonicalOilPair\(proof, benchmark, asOfDate\)/);
  assert.match(verifier, /original raw records and publisher identity/);
  assert.match(verifier, /\.in\("id", ids\)/);
  assert.doesNotMatch(verifier, /gap-web:/);
});
