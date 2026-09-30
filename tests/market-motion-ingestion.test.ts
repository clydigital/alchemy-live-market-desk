import test from "node:test";
import assert from "node:assert/strict";

import {
  MARKET_MOTION_RUN_LIMIT,
  buildMarketMotionCandidates,
} from "../lib/market-motion-ingestion.ts";
import type { IntakeItemInput } from "../lib/research-update.ts";

type ScoredItem = IntakeItemInput & {
  candidateScore: number;
  evidence: Array<{
    title: string;
    url: string;
    publisher: string;
    publishedAt: string;
    claim: string;
  }>;
};

const NOW = new Date("2026-10-01T02:00:00Z");

function item(overrides: Partial<ScoredItem> = {}): ScoredItem {
  return {
    itemKey: "reuters:mu-hbm",
    itemType: "news",
    publisher: "Reuters",
    title: "Micron HBM pricing stays tight as AI demand expands",
    url: "https://www.reuters.com/technology/example",
    publishedAt: "2026-10-01T00:30:00Z",
    summary: "Micron said HBM demand remains strong while supply stays constrained.",
    affectedStorySlugs: [],
    sourceQuality: 88,
    relevance: 92,
    novelty: 88,
    materiality: 90,
    recommendedAction: "collect_evidence",
    newsSignal: "Memory pricing remains an important AI infrastructure constraint.",
    evidence: [{
      title: "Micron HBM pricing stays tight as AI demand expands",
      url: "https://www.reuters.com/technology/example",
      publisher: "Reuters",
      publishedAt: "2026-10-01T00:30:00Z",
      claim: "Micron said HBM demand remains strong while supply stays constrained.",
    }],
    candidateScore: 90,
    ...overrides,
  };
}

test("Market Motion ingestion admits fresh, high-quality traceable reporting without promoting it", () => {
  const candidates = buildMarketMotionCandidates([item()], [], { now: NOW, researchRunId: "run-1" });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].lifecycleState, "MOTION");
  assert.equal(candidates[0].verificationState, "REPORTED");
  assert.equal(candidates[0].sourceKind, "reporting");
  assert.equal(candidates[0].researchRunId, "run-1");
  assert.equal(candidates[0].primaryRegimeSlug, "us-china-ai");
  assert.ok(candidates[0].tickers?.includes("MU"));
  assert.match(candidates[0].bigPictureBridge, /US–China AI regime/);
});

test("Official high-quality evidence can be marked VERIFIED while staying Motion", () => {
  const official = item({
    itemKey: "bls:cpi",
    publisher: "BLS",
    title: "Consumer Price Index release",
    url: "https://www.bls.gov/news.release/cpi.nr0.htm",
    summary: "The Bureau of Labor Statistics published the latest CPI release.",
    sourceQuality: 96,
    evidence: [{
      title: "Consumer Price Index release",
      url: "https://www.bls.gov/news.release/cpi.nr0.htm",
      publisher: "BLS",
      publishedAt: "2026-10-01T00:30:00Z",
      claim: "The Bureau of Labor Statistics published the latest CPI release.",
    }],
  });

  const [candidate] = buildMarketMotionCandidates([official], [], { now: NOW });

  assert.equal(candidate.sourceKind, "official");
  assert.equal(candidate.verificationState, "VERIFIED");
  assert.equal(candidate.lifecycleState, "MOTION");
  assert.equal(candidate.category, "MACRO");
});

test("Exact upstream Story slugs are linked; fuzzy Story guessing is not used", () => {
  const stories = [
    { id: "story-ai", slug: "china-us-ai-war", title: "China–US AI War" },
    { id: "story-energy", slug: "energy-security", title: "Energy Security" },
  ];

  const exact = buildMarketMotionCandidates([
    item({ affectedStorySlugs: ["china-us-ai-war"] }),
  ], stories, { now: NOW });

  assert.equal(exact[0].primaryStoryId, "story-ai");

  const fuzzy = buildMarketMotionCandidates([
    item({ affectedStorySlugs: ["not-a-story"] }),
  ], stories, { now: NOW });

  assert.equal(fuzzy[0].primaryStoryId, null);
});

test("Market Motion rejects stale, weak, non-actionable or untraceable news", () => {
  const candidates = buildMarketMotionCandidates([
    item({ itemKey: "stale", publishedAt: "2026-09-25T00:00:00Z" }),
    item({ itemKey: "weak", candidateScore: 68 }),
    item({ itemKey: "monitor", recommendedAction: "monitor" }),
    item({ itemKey: "no-evidence", evidence: [] }),
  ], [], { now: NOW });

  assert.deepEqual(candidates, []);
});

test("Ready creator transcripts can qualify, but missing transcripts cannot", () => {
  const ready = item({
    itemKey: "video:ready",
    itemType: "video",
    publisher: "StockedUp",
    url: "https://www.youtube.com/watch?v=example",
    transcriptStatus: "ready",
    transcriptText: "AI memory supply remains constrained. ".repeat(20),
    evidence: [],
    sourceQuality: 84,
    relevance: 90,
    novelty: 86,
    materiality: 88,
    candidateScore: 86,
  });
  const blocked = item({
    ...ready,
    itemKey: "video:blocked",
    transcriptStatus: "unavailable",
    transcriptText: undefined,
  });

  const candidates = buildMarketMotionCandidates([ready, blocked], [], { now: NOW });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].sourceKind, "creator");
  assert.equal(candidates[0].verificationState, "REPORTED");
});

test("Per-run Market Motion output is bounded and priority-sorted", () => {
  const items = Array.from({ length: MARKET_MOTION_RUN_LIMIT + 3 }, (_, index) => item({
    itemKey: `item-${index}`,
    candidateScore: 80 + index,
    materiality: 80 + index,
    title: `Micron AI memory update ${index}`,
    url: `https://www.reuters.com/technology/example-${index}`,
    evidence: [{
      title: `Micron AI memory update ${index}`,
      url: `https://www.reuters.com/technology/example-${index}`,
      publisher: "Reuters",
      publishedAt: "2026-10-01T00:30:00Z",
      claim: "Micron AI memory evidence.",
    }],
  }));

  const candidates = buildMarketMotionCandidates(items, [], { now: NOW });

  assert.equal(candidates.length, MARKET_MOTION_RUN_LIMIT);
  assert.equal(candidates[0].motionKey, `intake:item-${MARKET_MOTION_RUN_LIMIT + 2}`);
});
