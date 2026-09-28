import test from "node:test";
import assert from "node:assert/strict";

import type { Story } from "../lib/data.ts";
import type { DossierPresentationV1 } from "../lib/dossier-v2/presentation-adapter.ts";
import type { StoryEvent } from "../lib/persistence/contracts.ts";
import {
  materialProjectionSignature,
  REGIME_PROJECTOR_CONTRACT_VERSION,
} from "../lib/regime-engine.ts";
import {
  buildRegimeProjection,
  classifyRegimeStory,
  routeStoryToRegimes,
  routeTextToRegimes,
} from "../lib/regimes.ts";

function story(overrides: Partial<Story> = {}): Story {
  return {
    id: "story-1",
    slug: "fed-long-end-stress",
    title: "Falling Oil Is Not Yet Delivering a Clean Dovish Rates Signal",
    thesis: "Long-end pressure remains restrictive.",
    status: "publish",
    confidence: 80,
    rank: 1,
    market_question: "Why are long yields still high?",
    dominant_narrative: null,
    best_explanation: null,
    strongest_support: null,
    strongest_contradiction: null,
    priced_assessment: null,
    confirmation_trigger: null,
    invalidation_trigger: null,
    next_catalyst: null,
    article_angle: null,
    provisional_title: null,
    article_verdict: "develop",
    assets: ["US10Y", "US30Y", "XAUUSD"],
    source_quality: 80,
    novelty: 60,
    persistence: 90,
    trader_relevance: 90,
    article_potential: 75,
    ...overrides,
  };
}

function event(overrides: Partial<StoryEvent> = {}): StoryEvent {
  return {
    id: "event-1",
    story_id: "story-1",
    source_id: null,
    evidence_id: null,
    observation_id: null,
    research_run_id: null,
    legacy_update_id: null,
    event_type: "confirmation",
    headline: "Long yields remain elevated",
    detail: "US long-end yields stayed restrictive despite softer oil.",
    impact: "supports",
    confidence_delta: 3,
    event_at: "2026-09-28T01:00:00Z",
    recorded_at: "2026-09-28T01:01:00Z",
    metadata: {},
    created_by: null,
    ...overrides,
  };
}

function dossier(): DossierPresentationV1 {
  return {
    asOf: "2026-09-28T01:05:00Z",
    rateRegime: {
      contractVersion: "rate-regime/1",
      asOf: "2026-09-28T01:05:00Z",
      state: "HAWKISH",
      score: 60,
      confidence: "HIGH",
      summary: "Rates conditions are restrictive.",
      nextMeetingRateOutlook: "MORE_HAWKISH",
      fedWatchExpectedDirection: "HIKE_ODDS_UP",
      trigger: null,
      observedRatePricing: null,
      observedConfirmation: null,
      usRatesReaction: null,
      usRatesInterpretation: null,
      fredBacked: true,
      curve: {
        spreadBps: 12,
        state: "POSITIVE",
        detail: "10Y minus 2Y is +12 bp.",
        evidenceRefs: ["curve"],
      },
      signals: [
        {
          key: "POLICY",
          label: "Policy / macro impulse",
          state: "HAWKISH",
          score: 2,
          detail: "Policy impulse is hawkish.",
          evidenceRefs: ["policy"],
        },
        {
          key: "TREASURY_SUPPLY",
          label: "Treasury supply / buyback relief",
          state: "HAWKISH",
          score: 1,
          detail: "Treasury supply remains a long-end pressure despite larger buybacks.",
          evidenceRefs: ["treasury-supply"],
        },
        {
          key: "LONG_END",
          label: "Long-end nominal yields",
          state: "HAWKISH",
          score: 1,
          detail: "US 10Y and 30Y remain elevated.",
          evidenceRefs: ["long-end"],
        },
      ],
      drivers: [],
      contradictions: [],
      coverage: { present: 5, total: 5, missing: [] },
      evidenceRefs: ["policy", "treasury-supply", "long-end"],
      gaps: [],
    },
    dollarLiquidity: null,
  } as unknown as DossierPresentationV1;
}

test("exact Story routing preserves core and bridge Regime membership", () => {
  const routes = routeStoryToRegimes(story({
    slug: "ai-financing-stress",
    title: "AI Boom Hits the Cost of Capital",
  }));
  assert.deepEqual(routes.slice(0, 2).map((route) => [route.regime, route.subgroup, route.role]), [
    ["us-china-ai", "financing", "core"],
    ["global-cost-of-capital", "credit-financing", "bridge"],
  ]);
});

test("deterministic text routing maps Treasury and long-end news without creating a Story", () => {
  const routes = routeTextToRegimes("Treasury 30Y auction tails as long-end yields rise", 3);
  assert.ok(routes.some((route) => route.regime === "global-cost-of-capital" && route.subgroup === "treasury-fiscal"));
  assert.ok(routes.some((route) => route.regime === "global-cost-of-capital" && route.subgroup === "long-end"));
});

test("Cost-of-Capital Regime reuses the canonical Dossier rate-regime/1 telemetry", () => {
  const projection = buildRegimeProjection({
    stories: [story()],
    events: [event()],
    versions: [],
    newsThreads: [],
    statements: [],
    dossier: dossier(),
  });
  const rates = projection.find((item) => item.slug === "global-cost-of-capital");
  assert.ok(rates);
  assert.equal(rates.state, "Rates restrictive · broader funding partial");
  assert.equal(rates.stateKind, "unresolved");
  assert.equal(rates.confidence, "PARTIAL · rates HIGH");
  const longEnd = rates.subgroups.find((item) => item.key === "long-end");
  assert.ok(longEnd);
  assert.ok(longEnd.telemetry.some((item) => item.source === "rate-regime/1" && item.key === "LONG_END"));
  assert.ok(longEnd.stories.some((item) => item.slug === "fed-long-end-stress"));
  const fiscal = rates.subgroups.find((item) => item.key === "treasury-fiscal");
  assert.ok(fiscal);
  assert.ok(fiscal.telemetry.some((item) => item.source === "rate-regime/1" && item.key === "TREASURY_SUPPLY"));
});

test("raw routed news stays interpretation pending and cannot strengthen the subgroup by itself", () => {
  const projection = buildRegimeProjection({
    stories: [],
    events: [],
    versions: [],
    newsThreads: [{
      id: "news-1",
      domain: "rates",
      category: "Treasury",
      headline: "Treasury announces larger long-end buybacks",
      summary: "A verified Treasury announcement.",
      current_view: null,
      source_url: "https://example.com/treasury",
      source_type: "official",
      published_at: "2026-09-28T02:00:00Z",
      importance: 90,
      affected_assets: ["US30Y"],
    }],
    statements: [],
    dossier: null,
  });
  const rates = projection.find((item) => item.slug === "global-cost-of-capital");
  const fiscal = rates?.subgroups.find((item) => item.key === "treasury-fiscal");
  assert.ok(fiscal);
  assert.equal(fiscal.state, "Unresolved");
  assert.equal(fiscal.stateKind, "unresolved");
  assert.equal(fiscal.nodes[0]?.state, "interpretation_pending");
});


test("pending news refreshes the live projection without changing the material Regime signature", () => {
  const base = buildRegimeProjection({
    stories: [story()],
    events: [event()],
    versions: [],
    newsThreads: [],
    statements: [],
    dossier: dossier(),
  }).find((item) => item.slug === "global-cost-of-capital");
  assert.ok(base);

  const withPendingNews = buildRegimeProjection({
    stories: [story()],
    events: [event()],
    versions: [],
    newsThreads: [{
      id: "news-pending",
      domain: "rates",
      category: "Treasury",
      headline: "Treasury issues another routine financing update",
      summary: "Verified factual delta awaiting Story interpretation.",
      current_view: null,
      source_url: "https://example.com/treasury-pending",
      source_type: "official",
      published_at: "2026-09-28T03:00:00Z",
      importance: 70,
      affected_assets: ["US30Y"],
    }],
    statements: [],
    dossier: dossier(),
  }).find((item) => item.slug === "global-cost-of-capital");
  assert.ok(withPendingNews);

  assert.deepEqual(
    materialProjectionSignature(withPendingNews),
    materialProjectionSignature(base),
  );
  assert.ok(
    withPendingNews.subgroups
      .flatMap((subgroup) => subgroup.nodes)
      .some((node) => node.id === "news:news-pending" && node.state === "interpretation_pending"),
  );
});

test("accepted Story-state changes alter the material Regime signature", () => {
  const supporting = buildRegimeProjection({
    stories: [story()],
    events: [event({ id: "supporting", impact: "supports" })],
    versions: [],
    newsThreads: [],
    statements: [],
    dossier: null,
  }).find((item) => item.slug === "global-cost-of-capital");
  assert.ok(supporting);

  const contested = buildRegimeProjection({
    stories: [story()],
    events: [
      event({ id: "supporting", impact: "supports" }),
      event({
        id: "contradiction",
        event_type: "contradiction",
        impact: "contradicts",
        headline: "Long-end pressure loses confirmation",
        event_at: "2026-09-28T04:00:00Z",
      }),
    ],
    versions: [],
    newsThreads: [],
    statements: [],
    dossier: null,
  }).find((item) => item.slug === "global-cost-of-capital");
  assert.ok(contested);

  assert.notDeepEqual(
    materialProjectionSignature(contested),
    materialProjectionSignature(supporting),
  );
});


test("Regime projector v2 makes Story maturity part of the persisted interpretation contract", () => {
  assert.equal(REGIME_PROJECTOR_CONTRACT_VERSION, "regime-projector/2");
});

test("unverified theme seeds stay mapped but cannot drive Regime state", () => {
  const seed = story({
    slug: "housing-rates-transmission",
    title: "Housing and rates transmission",
    article_verdict: "theme_seed_unverified",
    confidence: 30,
  });
  const maturity = classifyRegimeStory(seed);
  assert.equal(maturity.maturity, "seed");
  assert.equal(maturity.contributesToState, false);

  const rates = buildRegimeProjection({
    stories: [seed],
    events: [event({ headline: "Mortgage rates remain elevated" })],
    versions: [],
    newsThreads: [],
    statements: [],
    dossier: null,
  }).find((item) => item.slug === "global-cost-of-capital");

  assert.ok(rates);
  assert.equal(rates.state, "Coverage gap / non-durable Stories");
  assert.equal(rates.stateKind, "unresolved");
  assert.equal(rates.durableStories.length, 0);
  assert.equal(rates.contextStories[0]?.maturity, "seed");

  const housing = rates.subgroups.find((item) => item.key === "housing");
  assert.ok(housing);
  assert.equal(housing.state, "Unresolved");
  assert.equal(housing.durableStories.length, 0);
  assert.equal(housing.contextStories.length, 1);
  assert.equal(housing.nodes[0]?.state, "context");
});

test("very low-confidence Stories remain visible as early coverage rather than active Regime support", () => {
  const early = story({
    slug: "earnings-market-support",
    title: "Consumer weakness could stall earnings",
    confidence: 13,
    article_verdict: "research_engine",
  });
  const maturity = classifyRegimeStory(early);
  assert.equal(maturity.maturity, "early");
  assert.equal(maturity.contributesToState, false);

  const equity = buildRegimeProjection({
    stories: [early],
    events: [],
    versions: [],
    newsThreads: [],
    statements: [],
    dossier: null,
  }).find((item) => item.slug === "equity-rally-quality");

  assert.ok(equity);
  assert.equal(equity.state, "Coverage gap / non-durable Stories");
  assert.equal(equity.contextStories[0]?.slug, "earnings-market-support");
});

test("legacy same-session episode Stories are context, not durable Treasury branches", () => {
  const episode = story({
    slug: "rates-led-same-session-repricing-overwhelms-summit-optics",
    title: "Treasury yields spike as same-session summit optics fade",
    confidence: 75,
    article_verdict: "research_engine",
    status: "monitor",
  });
  const maturity = classifyRegimeStory(episode);
  assert.equal(maturity.maturity, "episode");
  assert.equal(maturity.contributesToState, false);

  const rates = buildRegimeProjection({
    stories: [episode],
    events: [event({ headline: "Yields dominate the session" })],
    versions: [],
    newsThreads: [],
    statements: [],
    dossier: null,
  }).find((item) => item.slug === "global-cost-of-capital");

  assert.ok(rates);
  assert.equal(rates.state, "Coverage gap / non-durable Stories");
  assert.equal(rates.contextStories[0]?.maturity, "episode");
  assert.ok(rates.subgroups.flatMap((item) => item.nodes).every((node) => node.state === "context"));
});

test("durable Stories still drive Story-led Regime state", () => {
  const durable = story({
    slug: "market-breadth-health",
    title: "Breadth transition remains incomplete",
    confidence: 72,
    article_verdict: "monitor",
  });
  const maturity = classifyRegimeStory(durable);
  assert.equal(maturity.maturity, "durable");
  assert.equal(maturity.contributesToState, true);

  const equity = buildRegimeProjection({
    stories: [durable],
    events: [],
    versions: [],
    newsThreads: [],
    statements: [],
    dossier: null,
  }).find((item) => item.slug === "equity-rally-quality");

  assert.ok(equity);
  assert.equal(equity.state, "Active / durable Stories");
  assert.equal(equity.stateKind, "interpreted");
  assert.equal(equity.durableStories.length, 1);
  assert.equal(equity.contextStories.length, 0);
});

test("changing only Story maturity changes the material Regime signature", () => {
  const durable = buildRegimeProjection({
    stories: [story({
      slug: "housing-rates-transmission",
      title: "Housing and rates transmission",
      confidence: 30,
      article_verdict: "develop",
    })],
    events: [],
    versions: [],
    newsThreads: [],
    statements: [],
    dossier: null,
  }).find((item) => item.slug === "global-cost-of-capital");
  assert.ok(durable);

  const seed = buildRegimeProjection({
    stories: [story({
      slug: "housing-rates-transmission",
      title: "Housing and rates transmission",
      confidence: 30,
      article_verdict: "theme_seed_unverified",
    })],
    events: [],
    versions: [],
    newsThreads: [],
    statements: [],
    dossier: null,
  }).find((item) => item.slug === "global-cost-of-capital");
  assert.ok(seed);

  assert.notDeepEqual(
    materialProjectionSignature(seed),
    materialProjectionSignature(durable),
  );
});
