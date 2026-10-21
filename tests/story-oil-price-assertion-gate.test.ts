import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  oilPriceAssertionSentences,
  oilPriceAssertionErrors,
  type VerifiedOilEvidence,
} from "../lib/intelligence/story-oil-price-gate.ts";

const MARKET_CONTEXT = "0c969f5a-712e-4fba-9610-0b3780d2a1a8";
const ORIGINAL_WTI = "a262807e-f0b6-4e19-a7e5-c54e2b6b6be0";
const ORIGINAL_ICE = "b262807e-f0b6-4e19-a7e5-c54e2b6b6be1";
const oilStory = "Near-term WTI and Brent front-month crude oil term structure";
const noVerified: VerifiedOilEvidence = new Map();
const verified: VerifiedOilEvidence = new Map([
  [ORIGINAL_WTI, new Set(["WTI" as const])],
  [ORIGINAL_ICE, new Set(["BRENT" as const])],
]);

function check(parts: string[], ids = [MARKET_CONTEXT], map: VerifiedOilEvidence = noVerified, storyDescription = oilStory) {
  return oilPriceAssertionErrors({ storyDescription, textParts: parts, citedEvidenceIds: ids, verifiedEvidence: map });
}

test("production v4 thesis reproduces an unsupported observed Brent premium", () => {
  const v4 = "Observed exchange-publisher pages plus an independent forward-curve print show a front/next premium in Brent. " +
    "If exchange final F1/F2 settlements confirm that premium, roll returns could rise.";
  const errors = check([v4]);
  assert.equal(errors.length, 1, "Third-party curve context cannot be promoted to observed Brent F1/F2 settlement");
  assert.match(errors[0], /original FINAL exchange/);
  assert.match(errors[0], /Observed exchange-publisher pages/);
});

test("production v4 whatChanged clause remains guarded despite later unverified caveat", () => {
  const changed = "New captures include an independent forward‑curve print showing front‑month backwardation " +
    "and accessible publisher pages for the same date, but archival exchange settlement files remain unverified.";
  assert.equal(check([changed]).length, 1);
  assert.equal(oilPriceAssertionSentences([changed]).length, 1);
});

test("conditional interpretation, confidence downgrade and source gap warnings still pass", () => {
  const permitted = [
    "If original ICE Brent FINAL settles confirm a front-month premium, the market may be backwardated.",
    "The Brent curve remains unverified; request the exchange FINAL front/next settlements.",
    "A third-party report claims Brent backwardation, but the exact dated prices are unverified.",
    "The current evidence is insufficient, so reduce confidence from 81 to 50.",
    "WTI backwardation is not established by the CME contract methodology page.",
    "Higher real yields can weigh on growth shares.",
  ];
  for (const text of permitted) assert.deepEqual(check([text]), [], text);
});

test("the exact cited canonical original pair is required for each named market", () => {
  assert.deepEqual(check(
    ["On 14 October 2026 Brent showed a front/next premium."],
    [ORIGINAL_ICE], verified), []);
  assert.equal(check(
    ["On 14 October 2026 Brent showed a front/next premium."],
    [ORIGINAL_WTI], verified).length, 1);
  assert.deepEqual(check(
    ["WTI is in backwardation."],
    [ORIGINAL_WTI], verified), []);
  assert.equal(check(
    ["WTI and Brent show front-month premiums."],
    [ORIGINAL_WTI], verified).length, 1);
  assert.deepEqual(check(
    ["WTI and Brent show front-month premiums."],
    [ORIGINAL_WTI, ORIGINAL_ICE], verified), []);
});

test("a UUID that merely appears in the cited list is not a verified source-chain receipt", () => {
  const forged: VerifiedOilEvidence = new Map();
  const errors = check(["Brent shows front/next premium."], [MARKET_CONTEXT, ORIGINAL_ICE], forged);
  assert.equal(errors.length, 1);
  const none = check(["Crude is in backwardation."], [MARKET_CONTEXT], forged,
    "Oil market crude forward curves");
  assert.equal(none.length, 1);
  assert.deepEqual(check(["The financial results at TSMC show strong cash flow."], [MARKET_CONTEXT], forged,
    "AI hardware issuer earnings"), []);
});

test("guards both canonical Story maintenance and original Story synthesis before mutation", () => {
  const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");
  const proof = readFileSync(new URL("../lib/intelligence/story-oil-price-proof.ts", import.meta.url), "utf8");
  assert.match(runtime, /story_oil_unmeasured_price_assertion_suppressed/);
  assert.match(runtime, /markStoryReviewRetryable\([\s\S]*Measured oil F1\/F2 assertion requires original FINAL/);
  assert.match(runtime, /if \(oilPriceAssertionSentences\(assertiveOilText\)\.length\)/);
  assert.match(runtime, /Canonical oil price measurement admission failed/);
  assert.match(runtime, /resolveVerifiedStoryOilPairs/);
  assert.match(proof, /verifiedCanonicalOilPair\(proof, benchmark, asOf\)/);
  for (const table of ["intelligence_evidence","normalised_observations","raw_source_records","intelligence_evidence_sources"]) {
    assert.ok(proof.includes('.from("' + table + '")'), table);
  }
  assert.doesNotMatch(proof, /insert\(|upsert\(|update\(/);
});
