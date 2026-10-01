import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  MacroPulseMotionInputError,
  buildMacroPulseMotionCandidates,
  buildMarketMotionCandidates,
  unifyMarketMotionCandidates,
  type MacroPulseMotionSubmission,
} from "../lib/market-motion-ingestion.ts";
import type { IntakeItemInput } from "../lib/research-update.ts";

const NOW = new Date("2026-10-01T08:30:00.000Z");

function submission(overrides: Partial<MacroPulseMotionSubmission> = {}): MacroPulseMotionSubmission {
  return {
    pulseId: "macro-pulse:2026-10-01:0800",
    pulseUrl: "https://www.notion.so/example-macro-pulse",
    pulseAsOf: "2026-10-01T08:00:00.000Z",
    candidates: [{
      candidateKey: "ust-10y-auction-tail",
      kind: "AUCTION_SHOCK",
      occurredAt: "2026-10-01T07:45:00.000Z",
      headline: "Treasury auction tail lifts long-end yield pressure",
      whatHappened: "A Treasury auction tailed while long-end yields stayed elevated.",
      marketReaction: "10Y and 30Y yields moved higher after the auction.",
      whyInteresting: "The move may test whether term-premium pressure is becoming the dominant rates channel.",
      nextTest: "Verify the auction statistics, then compare 10Y/30Y real yields, DXY and growth equities.",
      affectedStorySlugs: ["rates-duration-stress"],
      tickers: ["US10Y", "US30Y", "DXY"],
      materiality: 90,
      relevance: 92,
      novelty: 84,
      references: [{
        sourceName: "US Treasury",
        sourceUrl: "https://home.treasury.gov/example-auction",
        sourceKind: "official",
        publishedAt: "2026-10-01T07:40:00.000Z",
        claim: "Auction statistics require independent verification before they are treated as evidence.",
      }],
    }],
    ...overrides,
  };
}

function reportingItem(): IntakeItemInput & {
  candidateScore: number;
  evidence: Array<{ title: string; url: string; publisher: string; publishedAt: string; claim: string }>;
} {
  return {
    itemKey: "reuters:treasury-auction-tail",
    itemType: "news",
    publisher: "Reuters",
    title: "Treasury auction tail pushes long-end yields higher",
    url: "https://www.reuters.com/markets/us/example-auction",
    publishedAt: "2026-10-01T07:50:00.000Z",
    summary: "Treasury auction demand was weaker than expected and long-end yields rose.",
    affectedStorySlugs: ["rates-duration-stress"],
    sourceQuality: 90,
    relevance: 92,
    novelty: 84,
    materiality: 90,
    recommendedAction: "collect_evidence",
    evidence: [{
      title: "Treasury auction tail pushes long-end yields higher",
      url: "https://www.reuters.com/markets/us/example-auction",
      publisher: "Reuters",
      publishedAt: "2026-10-01T07:50:00.000Z",
      claim: "Treasury auction demand was weaker than expected and long-end yields rose.",
    }],
    candidateScore: 89,
  };
}

const stories = [{
  id: "story-rates",
  slug: "rates-duration-stress",
  title: "US Rate Regime",
}];

test("Macro Pulse produces discovery-only Motion with an exact Story link and verification task", () => {
  const candidates = buildMacroPulseMotionCandidates(submission(), stories, { now: NOW });
  assert.equal(candidates.length, 1);

  const candidate = candidates[0]!;
  assert.equal(candidate.lifecycleState, "MOTION");
  assert.equal(candidate.verificationState, "LEAD");
  assert.equal(candidate.sourceName, "Macro Pulse");
  assert.equal(candidate.sourceKind, "other");
  assert.equal(candidate.primaryStoryId, "story-rates");
  assert.equal(candidate.metadata?.ingestion, "macro-pulse-motion-candidate/v1");
  assert.equal(candidate.metadata?.pulseCandidateKind, "AUCTION_SHOCK");
  assert.deepEqual(candidate.metadata?.researchQuestions, [
    "Verify the auction statistics, then compare 10Y/30Y real yields, DXY and growth equities.",
  ]);

  const unified = unifyMarketMotionCandidates(candidates);
  const refs = unified[0]?.metadata?.sourceRefs as Array<{
    sourceName: string;
    verificationState: string;
    role: string;
  }>;
  assert.ok(refs.some((ref) => ref.sourceName === "Macro Pulse" && ref.role === "discovery" && ref.verificationState === "LEAD"));
  assert.ok(refs.some((ref) => ref.sourceName === "US Treasury" && ref.role === "discovery" && ref.verificationState === "LEAD"));
});

test("Macro Pulse rejects stale or below-threshold chatter before persistence", () => {
  const stale = submission({
    candidates: [{
      ...submission().candidates[0]!,
      occurredAt: "2026-09-28T07:45:00.000Z",
      materiality: 60,
    }],
  });

  assert.throws(
    () => buildMacroPulseMotionCandidates(stale, stories, { now: NOW }),
    (error: unknown) => {
      assert.ok(error instanceof MacroPulseMotionInputError);
      assert.ok(error.errors.some((message) => /outside the 48-hour Motion window/.test(message)));
      assert.ok(error.errors.some((message) => /materiality is below the Motion threshold/.test(message)));
      return true;
    },
  );
});

test("Macro Pulse auction lead deduplicates with later reporting and yields to the stronger source", () => {
  const macro = buildMacroPulseMotionCandidates(submission(), stories, { now: NOW })[0]!;
  const reporting = buildMarketMotionCandidates(
    [reportingItem()],
    stories,
    { now: NOW, researchRunId: "research-run-1" },
  )[0]!;

  const unified = unifyMarketMotionCandidates([macro, reporting], {
    researchRunId: "research-run-1",
  });

  assert.equal(unified.length, 1);
  assert.equal(unified[0]?.motionKey, "event:auction:treasury");
  assert.equal(unified[0]?.sourceName, "Reuters");
  assert.equal(unified[0]?.sourceKind, "reporting");
  assert.equal(unified[0]?.verificationState, "REPORTED");
  assert.equal(unified[0]?.researchRunId, "research-run-1");

  const refs = unified[0]?.metadata?.sourceRefs as Array<{ sourceName: string }>;
  assert.ok(refs.some((ref) => ref.sourceName === "Macro Pulse"));
  assert.ok(refs.some((ref) => ref.sourceName === "US Treasury"));
  assert.ok(refs.some((ref) => ref.sourceName === "Reuters"));
});

test("Macro Pulse bridge is optional and cannot directly mutate canonical Dossier or Story state", () => {
  const config = readFileSync(new URL("../lib/supabase/config.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/market-motion/macro-pulse/route.ts", import.meta.url), "utf8");
  const researchUpdate = readFileSync(new URL("../app/api/research-update/route.ts", import.meta.url), "utf8");

  assert.match(config, /MACHINE_AUTH_PATHS[\s\S]*"\/api\/market-motion\/macro-pulse"/);
  assert.match(route, /persistMarketMotionFromMacroPulseCandidates/);
  assert.match(route, /discoveryOnly: true/);
  assert.match(route, /canonicalMutation: false/);
  assert.doesNotMatch(route, /market_dossiers_v2|story_updates|runIntelligenceEngine|persistCanonicalJourneyEdition/);
  assert.doesNotMatch(researchUpdate, /persistMarketMotionFromMacroPulseCandidates|\/api\/market-motion\/macro-pulse/);
});
