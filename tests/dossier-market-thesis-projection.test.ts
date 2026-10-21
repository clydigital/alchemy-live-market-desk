import test from "node:test";
import assert from "node:assert/strict";

import { buildDossierMarketTheses } from "../lib/dossier-v2/market-thesis-projection.ts";
import type { DossierPresentationV1 } from "../lib/dossier-v2/presentation-adapter.ts";
import type { MarketMotionRecord } from "../lib/market-motion.ts";

const STORY_UUID = "26955788-e038-4e8a-abae-90cde0c17a90";
const OTHER_UUID = "1a018ad0-3e14-4e8b-8af8-2d6826f15a70";
const AS_OF = "2026-10-21T03:00:00.000Z";

function sourceDossier(overrides: Record<string, unknown> = {}): DossierPresentationV1 {
  return {
    dossierId: "a57e7b1d-0db4-4f13-8b5c-12eb769ef950",
    asOf: AS_OF,
    health: { degraded: false },
    whatMattersNow: { stories: [{
      id: "story:rate-transmission",
      persistentStoryId: STORY_UUID,
      title: "Gold and the yield curve are sending different signals",
      whatChanged: "The latest rate and gold observations merit comparison.",
      whyItMatters: "Discount-rate and safe-haven channels can dominate at different horizons.",
      mechanism: "Real yields affect opportunity cost while positioning can change the response.",
      conclusion: "A widening nominal curve alone does not establish a bearish gold regime.",
      whatWouldChangeMind: "Gold breaks down alongside rising real yields and dollar strength.",
      epistemicLabel: "SUPPORTED",
      evidenceRefs: ["evidence-rate-01"],
      investigationIds: ["invest:yield-gold"],
      chartIds: ["chart:gold-rates"],
    }] },
    watchNext: [{
      id: "invest:yield-gold",
      status: "investigating",
      storyIds: ["story:rate-transmission"],
      chartIds: ["chart:gold-rates"],
      divergence: "MATERIAL",
      expectedReaction: "Gold weakens as yields increase over the release window.",
      observedReaction: "Gold held steady despite the reported yield move.",
      reactionChecks: [{ relation: "DIVERGENT" }],
      competingExplanations: ["Positioning or safe-haven demand could offset real-yield pressure."],
    }],
    charts: {
      core: [{
        chart_id: "chart:gold-rates",
        ticker_or_instrument: "GC1!",
        timeframe: "4H",
        overlay_or_comparison: "US10Y real yield and DXY",
        exact_question: "Does gold remain resilient when real yields rise?",
        confirmation_condition: "Gold holds a higher low during rising real yields.",
        contradiction_condition: "Gold loses support as real yields rise.",
        linked_story_ids: ["story:rate-transmission"],
        linked_investigation_ids: ["invest:yield-gold"],
      }, {
        chart_id: "chart:unrelated",
        ticker_or_instrument: "CL1!",
        timeframe: "1D",
        exact_question: "Does crude oil follow the unrelated supply trend?",
        confirmation_condition: "Crude closes higher during the supply change.",
        contradiction_condition: "Crude breaks lower with weaker demand.",
        linked_story_ids: ["story:oil"],
        linked_investigation_ids: [],
      }],
      optional: [],
    },
    ...overrides,
  } as unknown as DossierPresentationV1;
}

function motion(
  id: string,
  storyId: string,
  occurredAt = "2026-10-21T02:00:00.000Z",
  verificationState = "LEAD",
): MarketMotionRecord {
  return {
    id, primary_story_id: storyId, occurred_at: occurredAt,
    lifecycle_state: "PROMOTED", verification_state: verificationState,
    headline: "Gold price behaviour diverges from the latest Treasury reading",
    source_name: "Exchange",
    source_url: "https://example.com/market/gold-yields",
    tickers: ["GOLD"],
    evidence_id: "motion-observation-not-canonical",
  } as unknown as MarketMotionRecord;
}

test("projector uses only persisted Story argument, measured divergence and exactly related charts", () => {
  const projected = buildDossierMarketTheses({
    dossier: sourceDossier(),
    motions: [motion("motion-1", STORY_UUID)],
  });
  assert.equal(projected.contractVersion, "dossier-market-theses/1");
  assert.equal(projected.items.length, 1);
  const [item] = projected.items;
  assert.match(item.thesis, /widening nominal curve/);
  assert.match(item.tension, /^Expected:/);
  assert.match(item.tension, /Observed:/);
  assert.match(item.countercase ?? "", /Positioning/);
  assert.equal(item.charts.length, 1);
  assert.equal(item.charts[0].instrument, "GC1!");
  assert.equal(item.canonicalStoryId, STORY_UUID);
  assert.deepEqual(item.evidenceRefs, ["evidence-rate-01"]);
  assert.equal(item.relatedDevelopments[0].motionId, "motion-1");
  assert.equal(item.status, "SUPPORTED");
  assert.doesNotMatch(JSON.stringify(item), /What can I write|What to mention|COTD|Opening Bell/i);
});

test("Motion association demands exact persistent Story UUID and a pre-Dossier timestamp", () => {
  const result = buildDossierMarketTheses({
    dossier: sourceDossier(),
    motions: [
      motion("wrong-story", OTHER_UUID),
      motion("future", STORY_UUID, "2026-10-21T04:00:00.000Z"),
      motion("correct", STORY_UUID, "2026-10-21T02:00:00.000Z"),
    ],
  });
  assert.deepEqual(result.items[0].relatedDevelopments.map(x=>x.motionId), ["correct"]);
  assert.deepEqual(result.items[0].evidenceRefs, ["evidence-rate-01"]);
});

test("an unmeasured apparent divergence is not promoted to a measured contradiction", () => {
  const source = sourceDossier();
  source.watchNext[0].reactionChecks = [];
  const result = buildDossierMarketTheses({ dossier: source });
  assert.equal(result.items[0].tension, source.whatMattersNow.stories[0].whatChanged);
});

test("degraded Dossier stays conditional and blank evidence or operational copy cannot create an argument", () => {
  const degraded = sourceDossier({ health: { degraded: true } });
  assert.equal(buildDossierMarketTheses({ dossier: degraded }).items[0].status, "CONDITIONAL");
  const empty = sourceDossier();
  empty.whatMattersNow.stories[0].evidenceRefs = [];
  assert.equal(buildDossierMarketTheses({ dossier: empty }).items.length, 0);
  const process = sourceDossier();
  process.whatMattersNow.stories[0].title = "Research Brain model status and next tasks";
  assert.equal(buildDossierMarketTheses({ dossier: process }).items.length, 0);
});

test("historical caller passing no contemporaneous Motion cannot attach current context", () => {
  const result = buildDossierMarketTheses({ dossier: sourceDossier(), motions: [] });
  assert.equal(result.items[0].relatedDevelopments.length, 0);
  assert.equal(result.asOf, AS_OF);
});
