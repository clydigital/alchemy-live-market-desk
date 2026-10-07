import test from "node:test";
import assert from "node:assert/strict";

import type { Story } from "../lib/data.ts";
import type { DossierPresentationV1 } from "../lib/dossier-v2/presentation-adapter.ts";
import type { StoryEvent, StoryThesisVersion } from "../lib/persistence/contracts.ts";
import {
  materialProjectionSignature,
  REGIME_PROJECTOR_CONTRACT_VERSION,
} from "../lib/regime-engine.ts";
import {
  buildRegimeProjection,
  classifyRegimeStory,
  REGIME_DEFINITIONS,
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

function canonicalVersion(value: Story, overrides: Partial<StoryThesisVersion> = {}): StoryThesisVersion {
  return {
    id: `version-${value.id}`,
    story_id: value.id,
    event_id: null,
    version_number: 1,
    title: value.title,
    thesis: value.thesis,
    status: value.status,
    confidence: value.confidence,
    market_question: value.market_question,
    dominant_narrative: value.dominant_narrative,
    best_explanation: value.best_explanation,
    strongest_support: value.strongest_support,
    strongest_contradiction: value.strongest_contradiction,
    priced_assessment: value.priced_assessment,
    confirmation_trigger: value.confirmation_trigger,
    invalidation_trigger: value.invalidation_trigger,
    next_catalyst: value.next_catalyst,
    article_angle: value.article_angle,
    provisional_title: value.provisional_title,
    article_verdict: value.article_verdict,
    assets: value.assets,
    portfolio_map: {},
    snapshot: {
      reasoning: {
        contractVersion: "canonical-story-reasoning/v1",
      },
    },
    change_reason: "material_evidence_recalibration",
    effective_at: "2026-09-28T01:00:00Z",
    created_at: "2026-09-28T01:00:00Z",
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

test("dossier Live integration preserves AI regime identity while widening the capital-cycle scope", () => {
  const ai = REGIME_DEFINITIONS.find((item) => item.slug === "us-china-ai");
  assert.ok(ai);
  assert.equal(ai.shortTitle, "AI Capital Cycle");
  assert.ok(ai.subgroups.some((item) => item.key === "private-capital"));
  assert.ok(ai.subgroups.some((item) => item.key === "control-governance"));
});

test("gated frontier-model rollout with delayed compute demand routes into AI Capital Cycle", () => {
  const routes = routeStoryToRegimes(story({
    slug: "openai-gates-frontier-model-and-delays-broad-compute-demand",
    title: "OpenAI gates Astra while broad compute demand is delayed",
    thesis: "OpenAI limited the highest-risk capabilities to trusted testers, concentrating early deployments while paid API and enterprise compute demand develop more slowly.",
    market_question: "Why did the model release fail to produce the expected broad compute demand?",
    assets: ["GOOGL"],
  }));

  assert.deepEqual(routes.map((route) => [route.regime, route.subgroup, route.role]), [
    ["us-china-ai", "control-governance", "core"],
    ["us-china-ai", "cloud-inference", "supporting"],
    ["us-china-ai", "models", "supporting"],
  ]);
});

test("AI control and private-capital Stories route into dedicated AI Capital Cycle branches", () => {
  const control = routeStoryToRegimes(story({ slug: "ai-control-risk", title: "AI control risk" }));
  assert.ok(control.some((route) => route.regime === "us-china-ai" && route.subgroup === "control-governance" && route.role === "core"));

  const privateCapital = routeStoryToRegimes(story({ slug: "private-ai-capital", title: "Private AI capital" }));
  assert.ok(privateCapital.some((route) => route.regime === "us-china-ai" && route.subgroup === "private-capital" && route.role === "core"));
});

test("stable-value market structure routes into Cost of Capital credit financing", () => {
  const routes = routeStoryToRegimes(story({
    slug: "stable-value-market-contractual-structure-limits-industry-wide-stress",
    title: "Stable-value market structure limits broad funding stress",
    thesis: "Multiple wrap providers, separate accounts and crediting-rate mechanics reduce immediate participant liquidity pressure while counterparty and plan-level stress remain plausible.",
    market_question: "Do wrap-provider and insurance-counterparty mitigants reduce stable-value funding stress?",
    assets: [],
  }));

  assert.deepEqual(routes.map((route) => [route.regime, route.subgroup, route.role]), [
    ["global-cost-of-capital", "credit-financing", "core"],
  ]);
});

test("credit and sovereign transmission Stories keep exact durable routing", () => {
  const credit = routeStoryToRegimes(story({ slug: "global-credit-transmission", title: "Global credit transmission" }));
  assert.ok(credit.some((route) => route.regime === "global-cost-of-capital" && route.subgroup === "credit-financing" && route.role === "core"));

  const sovereign = routeStoryToRegimes(story({ slug: "global-sovereign-stress", title: "Global sovereign stress" }));
  assert.ok(sovereign.some((route) => route.regime === "global-cost-of-capital" && route.subgroup === "global-rates" && route.role === "core"));
});

test("dossier text routing recognises AI control, private capital and CRE transmission without asserting a Story", () => {
  const control = routeTextToRegimes("Frontier AI agent incident triggers a deployment pause and containment review", 4);
  assert.ok(control.some((route) => route.regime === "us-china-ai" && route.subgroup === "control-governance"));

  const privateCapital = routeTextToRegimes("Late-stage AI tender offer shows a wider private secondary-market discount", 4);
  assert.ok(privateCapital.some((route) => route.regime === "us-china-ai" && route.subgroup === "private-capital"));

  const credit = routeTextToRegimes("CMBS delinquency rises as private credit redemptions and CRE refinancing pressure build", 4);
  assert.ok(credit.some((route) => route.regime === "global-cost-of-capital" && route.subgroup === "credit-financing"));
});

test("deterministic text routing maps Treasury and long-end news without creating a Story", () => {
  const routes = routeTextToRegimes("Treasury 30Y auction tails as long-end yields rise", 3);
  assert.ok(routes.some((route) => route.regime === "global-cost-of-capital" && route.subgroup === "treasury-fiscal"));
  assert.ok(routes.some((route) => route.regime === "global-cost-of-capital" && route.subgroup === "long-end"));
});

test("global rates routing recognises USDJPY, JGB and foreign-flow language", () => {
  const routes = routeTextToRegimes("USDJPY reacts to JGB yields, TIC holdings and Japanese repatriation", 3);
  assert.ok(routes.some((route) => route.regime === "global-cost-of-capital" && route.subgroup === "global-rates"));
});

test("Cost-of-Capital Regime reuses the canonical Dossier rate-regime/1 telemetry", () => {
  const currentStory = story();
  const projection = buildRegimeProjection({
    stories: [currentStory],
    events: [event()],
    versions: [canonicalVersion(currentStory)],
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
  const currentStory = story();
  const currentVersion = canonicalVersion(currentStory);
  const base = buildRegimeProjection({
    stories: [currentStory],
    events: [event()],
    versions: [currentVersion],
    newsThreads: [],
    statements: [],
    dossier: dossier(),
  }).find((item) => item.slug === "global-cost-of-capital");
  assert.ok(base);

  const withPendingNews = buildRegimeProjection({
    stories: [currentStory],
    events: [event()],
    versions: [currentVersion],
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
  const currentStory = story();
  const currentVersion = canonicalVersion(currentStory);
  const supporting = buildRegimeProjection({
    stories: [currentStory],
    events: [event({ id: "supporting", impact: "supports" })],
    versions: [currentVersion],
    newsThreads: [],
    statements: [],
    dossier: null,
  }).find((item) => item.slug === "global-cost-of-capital");
  assert.ok(supporting);

  const contested = buildRegimeProjection({
    stories: [currentStory],
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
    versions: [currentVersion],
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


test("Regime projector v4 requires canonical reasoning for persisted Story-led interpretation", () => {
  assert.equal(REGIME_PROJECTOR_CONTRACT_VERSION, "regime-projector/4");
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

test("only an exact V1-backed Story version drives Story-led Regime state", () => {
  const durable = story({
    slug: "market-breadth-health",
    title: "Breadth transition remains incomplete",
    confidence: 72,
    article_verdict: "monitor",
  });
  const version = canonicalVersion(durable);
  const maturity = classifyRegimeStory(durable, version);
  assert.equal(maturity.maturity, "durable");
  assert.equal(maturity.contributesToState, true);

  const equity = buildRegimeProjection({
    stories: [durable],
    events: [],
    versions: [version],
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

test("mature Story without canonical V1 reasoning remains visible as context", () => {
  const legacy = story({
    slug: "market-breadth-health",
    title: "Breadth transition remains incomplete",
    confidence: 78,
    article_verdict: "monitor",
  });

  const maturity = classifyRegimeStory(legacy);
  assert.equal(maturity.maturity, "reasoning_gap");
  assert.equal(maturity.contributesToState, false);
  assert.match(maturity.reason, /exact pinned Story version has no canonical V1 reasoning snapshot/i);

  const equity = buildRegimeProjection({
    stories: [legacy],
    events: [event({ story_id: legacy.id, headline: "Breadth remains narrow" })],
    versions: [],
    newsThreads: [],
    statements: [],
    dossier: null,
  }).find((item) => item.slug === "equity-rally-quality");

  assert.ok(equity);
  assert.equal(equity.state, "Coverage gap / non-durable Stories");
  assert.equal(equity.stateKind, "unresolved");
  assert.equal(equity.durableStories.length, 0);
  assert.equal(equity.contextStories[0]?.maturity, "reasoning_gap");
  assert.ok(equity.subgroups.flatMap((item) => item.nodes).every((node) => node.state === "context"));
});

test("an older V1 snapshot cannot authorise a newer unreasoned Story version", () => {
  const currentStory = story({
    slug: "market-breadth-health",
    title: "Breadth transition remains incomplete",
    confidence: 78,
    article_verdict: "monitor",
  });
  const prior = canonicalVersion(currentStory, {
    id: "version-prior-v1",
    version_number: 1,
    effective_at: "2026-09-27T01:00:00Z",
    created_at: "2026-09-27T01:00:00Z",
  });
  const current = canonicalVersion(currentStory, {
    id: "version-current-no-reasoning",
    version_number: 2,
    snapshot: {},
    effective_at: "2026-09-28T01:00:00Z",
    created_at: "2026-09-28T01:00:00Z",
  });

  const equity = buildRegimeProjection({
    stories: [currentStory],
    events: [event({ story_id: currentStory.id, headline: "New Story event" })],
    versions: [prior, current],
    newsThreads: [],
    statements: [],
    dossier: null,
  }).find((item) => item.slug === "equity-rally-quality");

  assert.ok(equity);
  assert.equal(equity.durableStories.length, 0);
  assert.equal(equity.contextStories[0]?.versionId, current.id);
  assert.equal(equity.contextStories[0]?.maturity, "reasoning_gap");
  assert.ok(equity.subgroups.flatMap((item) => item.nodes).every((node) => node.state === "context"));
});

test("changing only Story maturity changes the material Regime signature", () => {
  const durableStory = story({
    slug: "housing-rates-transmission",
    title: "Housing and rates transmission",
    confidence: 30,
    article_verdict: "develop",
  });
  const durable = buildRegimeProjection({
    stories: [durableStory],
    events: [],
    versions: [canonicalVersion(durableStory)],
    newsThreads: [],
    statements: [],
    dossier: null,
  }).find((item) => item.slug === "global-cost-of-capital");
  assert.ok(durable);

  const seedStory = story({
    slug: "housing-rates-transmission",
    title: "Housing and rates transmission",
    confidence: 30,
    article_verdict: "theme_seed_unverified",
  });
  const seed = buildRegimeProjection({
    stories: [seedStory],
    events: [],
    versions: [canonicalVersion(seedStory)],
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


function thesisVersion(storyId: string, overrides: Partial<StoryThesisVersion> = {}): StoryThesisVersion {
  return {
    id: "version-stale",
    story_id: storyId,
    event_id: null,
    version_number: 6,
    title: "Weak jobs meet expensive oil; CPI becomes the tie-breaker",
    thesis: "July CPI is therefore the cleanest near-term decision point for rates.",
    status: "publish",
    confidence: 100,
    market_question: "Does CPI validate the rates repricing?",
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
    assets: ["US02Y", "US10Y"],
    portfolio_map: {},
    snapshot: {
      reasoning: {
        contractVersion: "canonical-story-reasoning/v1",
      },
      maintenanceContext: {
        operationalCatalystRefresh: true,
        reasoningPatch: {
          nextTest: {
            label: "U.S. CPI and Real Earnings on 12 August 2026",
            status: "expired",
            dueAt: null,
            expiresAt: "2026-09-28T06:53:39Z",
          },
        },
      },
    },
    change_reason: "material_evidence_recalibration",
    effective_at: "2026-09-28T06:53:39Z",
    created_at: "2026-09-28T06:53:39Z",
    created_by: null,
    ...overrides,
  };
}

test("expired decision-point Story remains mapped but becomes stale context until reframed", () => {
  const fed = story({
    id: "fed-stale",
    slug: "fed-rate-repricing",
    title: "Weak jobs meet expensive oil; CPI becomes the tie-breaker",
    thesis: "July CPI is therefore the cleanest near-term decision point for rates.",
    confidence: 100,
    article_verdict: "develop",
  });
  const version = thesisVersion(fed.id);

  const maturity = classifyRegimeStory(fed, version);
  assert.equal(maturity.maturity, "stale");
  assert.equal(maturity.contributesToState, false);

  const rates = buildRegimeProjection({
    stories: [fed],
    events: [event({ story_id: fed.id, headline: "Old CPI framework remains unresolved" })],
    versions: [version],
    newsThreads: [],
    statements: [],
    dossier: null,
  }).find((item) => item.slug === "global-cost-of-capital");

  assert.ok(rates);
  assert.equal(rates.durableStories.length, 0);
  assert.equal(rates.contextStories[0]?.maturity, "stale");
  const frontEnd = rates.subgroups.find((item) => item.key === "fed-front-end");
  assert.ok(frontEnd);
  assert.equal(frontEnd.durableStories.length, 0);
  assert.equal(frontEnd.contextStories[0]?.maturity, "stale");
  assert.ok(frontEnd.nodes.every((node) => node.state === "context"));
});

test("expired test does not stale a Story whose current framing no longer depends on that event", () => {
  const productivity = story({
    id: "productivity-current",
    slug: "productivity-labor-share",
    title: "Productivity gains now face a weaker-demand test",
    thesis: "Productivity gains remain conditional on household demand holding up.",
    confidence: 100,
    article_verdict: "develop",
  });
  const version = thesisVersion(productivity.id, {
    title: productivity.title,
    thesis: productivity.thesis,
  });

  const maturity = classifyRegimeStory(productivity, version);
  assert.equal(maturity.maturity, "durable");
  assert.equal(maturity.contributesToState, true);
});
