import assert from "node:assert/strict";
import test from "node:test";
import { deriveStoryScorecard } from "../lib/story-scorecard.ts";

test("P3 scorecard is bounded, prioritises evidence-backed live stories, and does not invent probability", () => {
  const scorecard = deriveStoryScorecard({
    confidence: 80, sourceQuality: 90, novelty: 70, persistence: 85,
    traderRelevance: 80, status: "developing", nextCatalyst: "Next CPI release",
  });
  assert.equal(scorecard.probability, null);
  assert.equal(scorecard.materiality, 80);
  assert.equal(scorecard.verification, 90);
  assert.equal(scorecard.momentum, 60);
  assert.equal(scorecard.urgency, 75);
  assert.ok(scorecard.priority > 70 && scorecard.priority <= 100);
});

test("P3 scorecard lowers urgency without a recorded catalyst and invalidated momentum", () => {
  const scorecard = deriveStoryScorecard({
    confidence: 20, sourceQuality: 10, novelty: 10, persistence: 10,
    traderRelevance: 10, status: "invalidated", nextCatalyst: null,
  });
  assert.equal(scorecard.momentum, 10);
  assert.equal(scorecard.urgency, 30);
  assert.ok(scorecard.priority < 30);
});

test("P3 lifecycle scoring only rewards canonical confirmed status", () => {
  const confirmed = deriveStoryScorecard({
    confidence: 50, sourceQuality: 50, novelty: 50, persistence: 50,
    traderRelevance: 50, status: "confirmed", nextCatalyst: null,
  });
  const unconfirmed = deriveStoryScorecard({
    confidence: 50, sourceQuality: 50, novelty: 50, persistence: 50,
    traderRelevance: 50, status: "unconfirmed", nextCatalyst: null,
  });

  assert.equal(confirmed.momentum, 75);
  assert.equal(unconfirmed.momentum, 45);
  assert.ok(confirmed.priority > unconfirmed.priority);
});
