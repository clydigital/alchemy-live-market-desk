import assert from "node:assert/strict";
import test from "node:test";

import type { StoryCandidate } from "../lib/intelligence/contracts.ts";
import {
  canonicalEventSignature,
  canonicalStoryEventSignature,
  compareStoryCandidates,
  selectFeaturedStories,
  selectQualifiedStories,
} from "../lib/intelligence/deduplication.ts";

function story(overrides: Partial<StoryCandidate> = {}): StoryCandidate {
  return {
    id: "story-default",
    slug: "story-default",
    title: "A testable market divergence",
    thesis: "A causal and falsifiable market thesis.",
    eventSignature: "independent-event",
    causalMechanism: "A change in expected cash flows reprices the affected asset.",
    affectedAssets: ["SPX"],
    decisiveEvidenceIds: ["evidence-default"],
    sourceAncestryGroupIds: ["source-default"],
    confirmationCriteria: ["The expected price response persists for two sessions."],
    invalidationCriteria: ["The price response fully reverses on confirming data."],
    nextCatalysts: ["Next official release"],
    confidence: 70,
    lifecycleStatus: "developing",
    publicationEligible: true,
    qualificationScore: 70,
    rank: null,
    ...overrides,
  };
}

test("the duplicated payroll cards collapse into one Story", () => {
  const rates = story({
    id: "fed-rate-repricing",
    slug: "fed-rate-repricing",
    rank: 1,
    title: "Payrolls puncture the September hike case",
    thesis: "The July jobs report weakens the case for near-term Fed tightening.",
    eventSignature: "BLS July nonfarm payrolls employment situation",
    causalMechanism: "Weaker job creation lowers the expected policy-rate path and front-end yields.",
    affectedAssets: ["US2Y", "DXY", "XAUUSD"],
    decisiveEvidenceIds: ["bls-july-payrolls"],
    sourceAncestryGroupIds: ["us-bls"],
    confirmationCriteria: ["Front-end yields fall as subsequent labour releases weaken."],
    invalidationCriteria: ["Large upward payroll revisions restore the tightening path."],
  });
  const productivity = story({
    id: "productivity-labor-share",
    slug: "productivity-labor-share",
    rank: 2,
    title: "Productivity gains face weaker demand",
    thesis: "The same payroll release may signal a softer demand impulse despite productivity gains.",
    eventSignature: "BLS July payrolls jobs report",
    causalMechanism: "Slower labour demand reduces household income growth and the revenue benefit of productivity.",
    affectedAssets: ["SPX", "XLY", "US10Y"],
    decisiveEvidenceIds: ["bls-july-payrolls"],
    sourceAncestryGroupIds: ["us-bls"],
    confirmationCriteria: ["Consumption and revenue revisions weaken after the jobs report."],
    invalidationCriteria: ["Real income and demand accelerate despite slower hiring."],
  });

  const comparison = compareStoryCandidates(productivity, rates);
  assert.equal(comparison.sameEvent, true);
  assert.equal(comparison.classification, "duplicate");
  assert.equal(comparison.exceptionProof.independentEvidenceDistinct, false);

  const selection = selectQualifiedStories([rates, productivity]);
  assert.deepEqual(selection.selected.map((item) => item.id), ["fed-rate-repricing"]);
  assert.equal(selection.excluded[0]?.story.id, "productivity-labor-share");
});

test("generic earnings language does not merge distinct company and breadth mechanisms", () => {
  const capex = canonicalEventSignature("AI capex cash conversion after quarterly earnings and company guidance");
  const breadth = canonicalEventSignature("Market breadth versus index strength while earnings support broadens");
  assert.notEqual(capex, breadth);
});

test("a future payroll catalyst does not relabel an unrelated persistent Story", () => {
  const signature = canonicalStoryEventSignature({
    title: "Can earnings keep the market alive?",
    thesis: "Guidance and breadth decide whether index support lasts.",
    causalMechanism: "Positive earnings reactions broaden when estimates rise.",
  });
  assert.notEqual(signature, "us_payrolls");
});

test("same-event Stories remain separate only with a complete exception proof", () => {
  const first = story({
    id: "payroll-rates",
    eventSignature: "July payrolls",
    causalMechanism: "Policy expectations move front-end nominal yields.",
    affectedAssets: ["US2Y", "DXY"],
    decisiveEvidenceIds: ["bls-payroll"],
    sourceAncestryGroupIds: ["us-bls"],
    confirmationCriteria: ["OIS prices fewer hikes."],
    invalidationCriteria: ["OIS restores the prior hike probability."],
  });
  const distinct = story({
    id: "payroll-small-cap-credit",
    eventSignature: "Nonfarm payrolls",
    causalMechanism: "Independent bank lending evidence links hiring weakness to small-business refinancing stress.",
    affectedAssets: ["IWM", "HYG"],
    decisiveEvidenceIds: ["bank-lending-survey"],
    sourceAncestryGroupIds: ["independent-bank-panel"],
    confirmationCriteria: ["Small-business delinquencies rise while large-cap credit remains stable."],
    invalidationCriteria: ["Small-business lending volumes and repayment performance improve."],
  });

  const comparison = compareStoryCandidates(distinct, first);
  assert.equal(comparison.classification, "related_distinct");
  assert.equal(comparison.exceptionProof.satisfied, true);
});

test("publication allows fewer than 15 and never pads the set", () => {
  const candidates = [
    story({ id: "one", eventSignature: "event-one", rank: 1 }),
    story({ id: "two", eventSignature: "event-two", rank: 2 }),
    story({ id: "blocked", eventSignature: "event-three", rank: 3, publicationEligible: false }),
  ];
  const selection = selectQualifiedStories(candidates);
  assert.deepEqual(selection.selected.map((item) => item.id), ["one", "two"]);
});

test("persistent publication has a hard maximum of 15", () => {
  const candidates = Array.from({ length: 20 }, (_, index) => story({
    id: `story-${index}`,
    eventSignature: `unrelated-event-${index}`,
    causalMechanism: `Distinct mechanism ${index}`,
    affectedAssets: [`ASSET-${index}`],
    decisiveEvidenceIds: [`evidence-${index}`],
    sourceAncestryGroupIds: [`source-${index}`],
    rank: index + 1,
  }));
  assert.equal(selectQualifiedStories(candidates).selected.length, 15);
});

test("the featured rail selects at most six published Stories by recency", () => {
  const candidates = Array.from({ length: 9 }, (_, index) => story({
    id: `recency-${index}`,
    eventSignature: `recency-event-${index}`,
    causalMechanism: `Recency mechanism ${index}`,
    affectedAssets: [`RECENCY-ASSET-${index}`],
    decisiveEvidenceIds: [`recency-evidence-${index}`],
    sourceAncestryGroupIds: [`recency-source-${index}`],
    qualificationScore: 99 - index,
    recencyAt: new Date(Date.UTC(2026, 7, index + 1)).toISOString(),
  }));
  const published = selectQualifiedStories(candidates).selected;
  const featured = selectFeaturedStories(published);
  assert.equal(featured.length, 6);
  assert.deepEqual(featured.map((item) => item.id), ["recency-8", "recency-7", "recency-6", "recency-5", "recency-4", "recency-3"]);
});

test("an Alchemy Story does not require an external article URL", () => {
  const originalResearch = story({ canonicalExternalUrl: null, researchSynthesis: "Alchemy synthesis across official labour data and market pricing." });
  assert.equal(selectQualifiedStories([originalResearch]).selected.length, 1);
});
