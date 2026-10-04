import test from "node:test";
import assert from "node:assert/strict";

import {
  MARKET_MOTION_RUN_LIMIT,
  buildMarketMotionCandidates,
  buildTranscriptMotionCandidates,
  unifyMarketMotionCandidates,
  type ReviewedTranscriptMotionRow,
} from "../lib/market-motion-ingestion.ts";
import { encodeResearchGapHandoffContext } from "../lib/research-gap-handoff.ts";
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
    item({ itemKey: "stale", publishedAt: "2026-09-29T01:00:00Z" }),
    item({ itemKey: "weak", candidateScore: 68 }),
    item({ itemKey: "monitor", recommendedAction: "monitor" }),
    item({ itemKey: "no-evidence", evidence: [] }),
  ], [], { now: NOW });

  assert.deepEqual(candidates, []);
});

test("Research Gap handoff evidence cannot re-enter Market Motion", () => {
  const divergenceNote = encodeResearchGapHandoffContext({
    kind: "research_gap_gate",
    gateRunId: "gate-1",
    gapId: "gap-1",
    researchQuestion: "Does the long-end move confirm the rates thesis?",
    finding: "The source evidence resolves the funded Gap branch.",
    confidence: 88,
    outcome: "CONFIRMING",
  });

  const candidates = buildMarketMotionCandidates([
    item({
      itemKey: "gap-handoff-source",
      divergenceNote,
    }),
  ], [], { now: NOW });

  assert.deepEqual(candidates, []);
});

test("Market Motion keeps reporting inside the 48-hour window", () => {
  const candidates = buildMarketMotionCandidates([
    item({ itemKey: "fresh-47h", publishedAt: "2026-09-29T03:00:00Z" }),
  ], [], { now: NOW });

  assert.equal(candidates.length, 1);
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


function reviewedTranscriptRow(overrides: Partial<ReviewedTranscriptMotionRow> = {}): ReviewedTranscriptMotionRow {
  return {
    id: "creator-row-anthropic",
    run_id: "creator-run-1",
    item_key: "youtube:stockedup:anthropic001",
    publisher: "StockedUp",
    title: "Anthropic IPO and AI economics",
    url: "https://www.youtube.com/watch?v=anthropic01",
    published_at: "2026-10-01T00:10:00Z",
    summary: "The creator discusses Anthropic's IPO filing, losses and compute economics.",
    affected_story_slugs: [],
    source_quality: 80,
    relevance: 90,
    novelty: 92,
    materiality: 90,
    candidate_score: 88,
    recommended_action: "collect_evidence",
    transcript_status: "ready",
    video_review_status: "reviewed",
    transcript_motion_leads: [
      {
        kind: "claim",
        text: "Anthropic filed IPO papers and is running at more than $8 billion of operating losses.",
        tags: ["company_event", "statistic"],
        entities: ["Anthropic", "IPO"],
        verificationNeeded: true,
        verificationTarget: "Anthropic IPO filing / prospectus",
        searchPrompt: "Verify Anthropic IPO filing and operating-loss figure.",
        articleHook: null,
        priority: 94,
      },
      {
        kind: "article_hook",
        text: "Anthropic's IPO makes AI unit economics publicly testable.",
        tags: ["writing_angle"],
        entities: ["Anthropic"],
        verificationNeeded: false,
        verificationTarget: null,
        searchPrompt: null,
        articleHook: "Anthropic's IPO makes AI unit economics publicly testable.",
        priority: 94,
      },
      {
        kind: "research_question",
        text: "How much of the losses are operating burn versus financing/accounting effects?",
        tags: ["research_question"],
        entities: ["Anthropic"],
        verificationNeeded: false,
        verificationTarget: null,
        searchPrompt: "How much of Anthropic's losses are operating burn versus financing/accounting effects?",
        articleHook: null,
        priority: 93,
      },
    ],
    review_reason: "Creator lead requires independent verification.",
    ...overrides,
  };
}

test("reviewed transcripts create discrete creator leads instead of one video-summary Motion card", () => {
  const candidates = buildTranscriptMotionCandidates([reviewedTranscriptRow()], [], { now: NOW });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].sourceKind, "creator");
  assert.equal(candidates[0].verificationState, "LEAD");
  assert.match(candidates[0].headline, /Anthropic filed IPO papers/);
  assert.doesNotMatch(candidates[0].headline, /Anthropic IPO and AI economics$/);
  assert.match(candidates[0].whatHappened, /remains a creator-sourced lead until independently corroborated/);
  assert.deepEqual(candidates[0].metadata?.writingAngles, ["Anthropic's IPO makes AI unit economics publicly testable."]);
  assert.deepEqual(candidates[0].metadata?.researchQuestions, ["How much of Anthropic's losses are operating burn versus financing/accounting effects?"]);
});

test("Research Gap handoff videos stay fenced after transcript review", () => {
  const divergenceNote = encodeResearchGapHandoffContext({
    kind: "research_gap_gate",
    gateRunId: "gate-video",
    gapId: "gap-video",
    researchQuestion: "Does the creator evidence resolve the funded branch?",
    finding: "The Gap executor admitted this video as underlying evidence.",
    confidence: 84,
    outcome: "UNRESOLVED",
  });
  const candidates = buildTranscriptMotionCandidates([
    reviewedTranscriptRow({ divergence_note: divergenceNote }),
  ], [], { now: NOW });

  assert.deepEqual(candidates, []);
});

test("creator Anthropic lead and Reuters IPO reporting collapse into one event with stronger reporting primary", () => {
  const creator = buildTranscriptMotionCandidates([reviewedTranscriptRow()], [], { now: NOW })[0];
  const [reuters] = buildMarketMotionCandidates([
    item({
      itemKey: "reuters:anthropic-ipo",
      title: "Anthropic IPO filing reveals heavy losses and compute commitments",
      url: "https://www.reuters.com/technology/artificial-intelligence/anthropic-ipo-example",
      summary: "Anthropic's IPO prospectus disclosed large operating losses alongside rapid revenue growth and major compute commitments.",
      newsSignal: "The filing turns private AI economics into a public financing and unit-economics test.",
      evidence: [{
        title: "Anthropic IPO filing reveals heavy losses and compute commitments",
        url: "https://www.reuters.com/technology/artificial-intelligence/anthropic-ipo-example",
        publisher: "Reuters",
        publishedAt: "2026-10-01T00:40:00Z",
        claim: "Anthropic's IPO prospectus disclosed large operating losses.",
      }],
    }),
  ], [], { now: NOW, researchRunId: "dossier-run-1" });

  const unified = unifyMarketMotionCandidates([creator, reuters], { researchRunId: "dossier-run-1" });

  assert.equal(unified.length, 1);
  assert.equal(unified[0].motionKey, "event:ipo:anthropic");
  assert.equal(unified[0].sourceKind, "reporting");
  assert.equal(unified[0].sourceName, "Reuters");
  assert.equal(unified[0].verificationState, "REPORTED");
  assert.equal(unified[0].researchRunId, "dossier-run-1");
  const refs = unified[0].metadata?.sourceRefs as Array<{ sourceKind: string; sourceUrl: string }>;
  assert.equal(refs.length, 2);
  assert.ok(refs.some((ref) => ref.sourceKind === "creator"));
  assert.ok(refs.some((ref) => ref.sourceKind === "reporting"));
  assert.deepEqual(unified[0].metadata?.writingAngles, ["Anthropic's IPO makes AI unit economics publicly testable."]);
  assert.deepEqual(unified[0].metadata?.researchQuestions, ["How much of Anthropic's losses are operating burn versus financing/accounting effects?"]);
});

test("unrelated events remain separate even when they share the same source window", () => {
  const creator = buildTranscriptMotionCandidates([reviewedTranscriptRow()], [], { now: NOW })[0];
  const [micron] = buildMarketMotionCandidates([item()], [], { now: NOW });
  const unified = unifyMarketMotionCandidates([creator, micron]);

  assert.equal(unified.length, 2);
});


test("later independent reporting preserves exact origin keys for the unified Motion event", () => {
  const creator = buildTranscriptMotionCandidates([reviewedTranscriptRow()], [], { now: NOW })[0];
  const [reuters] = buildMarketMotionCandidates([
    item({
      itemKey: "reuters:anthropic-ipo",
      title: "Anthropic IPO filing reveals heavy losses and compute commitments",
      url: "https://www.reuters.com/technology/artificial-intelligence/anthropic-ipo-example",
      summary: "Anthropic's IPO prospectus disclosed large operating losses alongside rapid revenue growth and major compute commitments.",
      evidence: [{
        title: "Anthropic IPO filing reveals heavy losses and compute commitments",
        url: "https://www.reuters.com/technology/artificial-intelligence/anthropic-ipo-example",
        publisher: "Reuters",
        publishedAt: "2026-10-01T00:40:00Z",
        claim: "Anthropic's IPO prospectus disclosed large operating losses.",
      }],
    }),
  ], [], { now: NOW, researchRunId: "run-reporting" });

  const [merged] = unifyMarketMotionCandidates([creator, reuters], { researchRunId: "run-reporting" });

  assert.deepEqual(merged.metadata?.originItemKeys, [
    "reuters:anthropic-ipo",
    "youtube:stockedup:anthropic001",
  ]);
});

test("later event merge cannot demote an already PROMOTED Motion", () => {
  const creator = buildTranscriptMotionCandidates([reviewedTranscriptRow()], [], { now: NOW })[0];
  const [reuters] = buildMarketMotionCandidates([
    item({
      itemKey: "reuters:anthropic-ipo",
      title: "Anthropic IPO filing reveals heavy losses and compute commitments",
      url: "https://www.reuters.com/technology/artificial-intelligence/anthropic-ipo-example",
      summary: "Anthropic's IPO prospectus disclosed large operating losses alongside rapid revenue growth and major compute commitments.",
      evidence: [{
        title: "Anthropic IPO filing reveals heavy losses and compute commitments",
        url: "https://www.reuters.com/technology/artificial-intelligence/anthropic-ipo-example",
        publisher: "Reuters",
        publishedAt: "2026-10-01T00:40:00Z",
        claim: "Anthropic's IPO prospectus disclosed large operating losses.",
      }],
    }),
  ], [], { now: NOW, researchRunId: "run-reporting" });
  const [base] = unifyMarketMotionCandidates([creator, reuters], { researchRunId: "run-reporting" });
  const promoted = {
    ...base,
    lifecycleState: "PROMOTED" as const,
    evidenceId: "evidence-anthropic",
    promotionReason: "Canonical evidence corroborated this Motion.",
    metadata: {
      ...(base.metadata || {}),
      promotionPolicy: "canonical-evidence-corroborated/v1",
      promotionEvidenceId: "evidence-anthropic",
      promotionEvidenceItemKey: "reuters:anthropic-ipo",
    },
  };
  const [official] = buildMarketMotionCandidates([
    item({
      itemKey: "sec:anthropic-ipo",
      publisher: "SEC",
      title: "Anthropic IPO filing reveals heavy losses and compute commitments",
      url: "https://www.sec.gov/Archives/edgar/data/example/anthropic.htm",
      summary: "Anthropic filed IPO materials disclosing operating losses and compute commitments.",
      sourceQuality: 98,
      evidence: [{
        title: "Anthropic IPO filing",
        url: "https://www.sec.gov/Archives/edgar/data/example/anthropic.htm",
        publisher: "SEC",
        publishedAt: "2026-10-01T00:50:00Z",
        claim: "Anthropic filed IPO materials.",
      }],
    }),
  ], [], { now: NOW, researchRunId: "run-official" });

  const [merged] = unifyMarketMotionCandidates([promoted, official], { researchRunId: "run-official" });

  assert.equal(merged.sourceKind, "filing");
  assert.equal(merged.verificationState, "VERIFIED");
  assert.equal(merged.lifecycleState, "PROMOTED");
  assert.equal(merged.evidenceId, "evidence-anthropic");
  assert.equal(merged.promotionReason, "Canonical evidence corroborated this Motion.");
  assert.equal(merged.metadata?.promotionPolicy, "canonical-evidence-corroborated/v1");
  assert.equal(merged.metadata?.promotionEvidenceId, "evidence-anthropic");
  assert.deepEqual(merged.metadata?.originItemKeys, [
    "sec:anthropic-ipo",
    "reuters:anthropic-ipo",
    "youtube:stockedup:anthropic001",
  ]);
});


test("expired promoted Motion is not revived by sticky merge preservation", () => {
  const creator = buildTranscriptMotionCandidates([reviewedTranscriptRow()], [], { now: NOW })[0];
  const [reuters] = buildMarketMotionCandidates([
    item({
      itemKey: "reuters:anthropic-ipo-expired",
      title: "Anthropic IPO filing reveals heavy losses and compute commitments",
      url: "https://www.reuters.com/technology/artificial-intelligence/anthropic-ipo-expired",
      summary: "Anthropic's IPO prospectus disclosed large operating losses alongside rapid revenue growth and major compute commitments.",
      evidence: [{
        title: "Anthropic IPO filing reveals heavy losses and compute commitments",
        url: "https://www.reuters.com/technology/artificial-intelligence/anthropic-ipo-expired",
        publisher: "Reuters",
        publishedAt: "2026-10-01T00:40:00Z",
        claim: "Anthropic's IPO prospectus disclosed large operating losses.",
      }],
    }),
  ], [], { now: NOW, researchRunId: "run-reporting-expired" });
  const [base] = unifyMarketMotionCandidates([creator, reuters], { researchRunId: "run-reporting-expired" });
  const expiredPromoted = {
    ...base,
    lifecycleState: "PROMOTED" as const,
    evidenceId: "evidence-expired",
    promotionReason: "Old corroboration.",
    expiresAt: "2026-10-01T01:00:00.000Z",
    metadata: {
      ...(base.metadata || {}),
      promotionPolicy: "canonical-evidence-corroborated/v1",
      promotionEvidenceId: "evidence-expired",
    },
  };
  const [official] = buildMarketMotionCandidates([
    item({
      itemKey: "sec:anthropic-ipo-fresh",
      publisher: "SEC",
      title: "Anthropic IPO filing reveals heavy losses and compute commitments",
      url: "https://www.sec.gov/Archives/edgar/data/example/anthropic-fresh.htm",
      summary: "Anthropic filed fresh IPO materials disclosing operating losses and compute commitments.",
      sourceQuality: 98,
      evidence: [{
        title: "Anthropic IPO filing",
        url: "https://www.sec.gov/Archives/edgar/data/example/anthropic-fresh.htm",
        publisher: "SEC",
        publishedAt: "2026-10-01T01:30:00Z",
        claim: "Anthropic filed fresh IPO materials.",
      }],
    }),
  ], [], { now: NOW, researchRunId: "run-official-fresh" });

  const [merged] = unifyMarketMotionCandidates([expiredPromoted, official], { researchRunId: "run-official-fresh" });

  assert.equal(merged.lifecycleState, "MOTION");
  assert.equal(merged.evidenceId ?? null, null);
  assert.equal(merged.promotionReason ?? null, null);
  assert.equal(merged.metadata?.promotionPolicy ?? null, null);
  assert.equal(merged.metadata?.promotionEvidenceId ?? null, null);
});
