import assert from "node:assert/strict";
import test from "node:test";

import {
  cleanEvidenceClaim,
  routeResearchItemToStories,
  sanitiseResearchText,
  type RoutableStory,
} from "../lib/intelligence/story-routing.ts";

const stories: RoutableStory[] = [
  {
    id: "oil",
    slug: "oil-physical-disruption",
    title: "Oil relief breaks as Hormuz talks stall",
    thesis: "Hormuz disruption can keep crude and inflation pressure elevated.",
    marketQuestion: "How much physical oil disruption can equities ignore?",
    nextCatalyst: "Hormuz shipping flows and Brent",
    assets: ["BRENT", "WTI"],
  },
  {
    id: "fed",
    slug: "fed-rate-repricing",
    title: "Weak jobs meet expensive oil; CPI becomes the tie-breaker",
    thesis: "Labour cooling and inflation pressure are pulling Fed expectations in opposite directions.",
    marketQuestion: "Will jobs weakness or inflation dominate Fed pricing?",
    nextCatalyst: "CPI and jobless claims",
    assets: ["US02Y", "DXY", "SPX"],
  },
  {
    id: "ai",
    slug: "ai-capex-cash-conversion",
    title: "AI capex is shifting from spending risk to financing risk",
    thesis: "Semiconductor demand remains strong but higher discount rates pressure long-duration AI valuations.",
    assets: ["NVDA", "AMD", "MU"],
  },
  {
    id: "china",
    slug: "china-ai-pressure",
    title: "China AI cost and model pressure",
    thesis: "Chinese AI competition can pressure model pricing and hardware economics.",
    assets: [],
  },
];

test("sanitises transport HTML and common entities before evidence persistence", () => {
  const raw = '<span property="schema:name">Initial Jobless Claims Refuse To Blink</span> &amp; yields rise';
  assert.equal(sanitiseResearchText(raw), "Initial Jobless Claims Refuse To Blink & yields rise");
});

test("placeholder creator summaries fall back to the clean title", () => {
  assert.equal(cleanEvidenceClaim({
    title: "Treasury buybacks explained",
    summary: "New monitored creator video discovered; transcript collection and claim verification are pending.",
  }), "Treasury buybacks explained");
});

test("routes Hormuz and crude evidence to the oil Story with explainable anchors", () => {
  const routes = routeResearchItemToStories({
    title: "Hormuz shipping stalls as Brent climbs",
    summary: "Iran tensions tightened physical crude flows and lifted Brent.",
    stories,
  });
  assert.equal(routes[0]?.storySlug, "oil-physical-disruption");
  assert.equal(routes[0]?.reasons.some((reason) => reason === "topic:oil"), true);
});

test("routes labour evidence to the Fed Story without requiring a new divergence", () => {
  const routes = routeResearchItemToStories({
    title: "Initial jobless claims remain firm",
    summary: "The labour market is cooling ahead of the next Fed decision.",
    stories,
  });
  assert.equal(routes.some((route) => route.storySlug === "fed-rate-repricing"), true);
});

test("asset and AI context route Micron evidence to the AI Story", () => {
  const routes = routeResearchItemToStories({
    title: "Micron falls after a Treasury yield jump",
    summary: "Memory demand remains strong while higher discount rates hit semiconductor valuations.",
    stories,
  });
  assert.equal(routes[0]?.storySlug, "ai-capex-cash-conversion");
});

test("weak geography-only overlap does not route generic China news into the China AI Story", () => {
  const routes = routeResearchItemToStories({
    title: "Chinese retailer offers remedies in European takeover review",
    summary: "The transaction concerns a consumer electronics acquisition.",
    stories,
  });
  assert.equal(routes.some((route) => route.storySlug === "china-ai-pressure"), false);
});

test("explicit reviewed transcript Story links are preserved and outrank inferred routes", () => {
  const routes = routeResearchItemToStories({
    title: "Cross-asset creator review",
    summary: "Treasury yields and oil are discussed together.",
    explicitStorySlugs: ["fed-rate-repricing"],
    stories,
  });
  assert.equal(routes[0]?.storySlug, "fed-rate-repricing");
  assert.equal(routes[0]?.score, 100);
});
