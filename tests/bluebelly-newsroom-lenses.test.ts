import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { NewsBriefV1 } from "../lib/market-brief-news.ts";
import {
  NEWSROOM_LENSES, projectVerifiedNewsroom,
} from "../lib/blue-desk-newsroom-lenses.ts";

const now = new Date("2026-10-27T13:00:00.000Z");

function report(id: string, headline: string, summary: string): NewsBriefV1 {
  return {
    contractVersion: "news-brief/1", contentType: "NEWS_BRIEF",
    verification: "SOURCE_VERIFIED", id, headline, summary,
    sourceName: "Original publisher",
    sourceUrl: "https://example.org/releases/" + id,
    sourceKind: "official",
    occurredAt: "2026-10-26T18:00:00.000Z",
    observedAt: "2026-10-26T19:00:00.000Z",
  };
}

test("three lenses share source-verified reports by ID, without duplicating claims", () => {
  const ai = report("k", "Moonshot releases new Kimi AI model",
    "The Chinese AI model announcement describes a coding-capability release.");
  const bond = report("t", "France bond yields rise in reported auction",
    "The government bond auction disclosure includes a source-linked financing update.");
  const equity = report("e", "Alphabet earnings and operating cash flow",
    "Quarterly revenue and cash flow figures appear in the issuer report.");
  const groups = projectVerifiedNewsroom([ai, bond, equity], now);
  assert.deepEqual(NEWSROOM_LENSES.map(x => x.id), [
    "ai-innovations", "geopolitics-bonds", "stocks-trading",
  ]);
  assert.equal(groups.uniqueEligibleCount, 3);
  assert.equal(groups.unclassifiedCount, 0);
  const [tech, geopolitics, stocks] = groups.groups;
  assert.deepEqual(tech.items.map(x => x.id), ["k"]);
  assert.deepEqual(geopolitics.items.map(x => x.id), ["t", "k"]);
  assert.deepEqual(stocks.items.map(x => x.id), ["e"]);
  assert.equal(tech.items[0].headline, ai.headline);
  assert.equal(tech.items[0].summary, ai.summary);
  assert.equal(tech.items[0].sourceUrl, ai.sourceUrl);
  assert.equal(tech.items[0].evidenceLabel, "SOURCE-VERIFIED REPORT");
  assert.equal("priceReaction" in tech.items[0], false);
  assert.equal("storyThesisVersionId" in tech.items[0], false);
});

test("future, stale, late-observed, wrongly labelled and insecure sources never enter", () => {
  const good = report("good", "AI coding agents increase model capability",
    "Original-source capability statement with required provenance.");
  const stale = { ...good, id: "stale", occurredAt: "2026-10-20T18:00:00.000Z" };
  const future = { ...good, id: "future", occurredAt: "2026-10-28T18:00:00.000Z" };
  const inverted = { ...good, id: "inverted", observedAt: "2026-10-25T10:00:00.000Z" };
  const badSource = { ...good, id: "url", sourceUrl: "http://example.org/releases/url" };
  const homepage = { ...good, id: "homepage", sourceUrl: "https://example.org/" };
  const login = { ...good, id: "login", sourceUrl: "https://user:pass@example.org/item" };
  const fake = { ...good, id: "fake", verification: "CREATOR_CLAIM" } as unknown as NewsBriefV1;
  const result = projectVerifiedNewsroom([
    stale, future, inverted, badSource, homepage, login, fake, good, good,
  ], now);
  assert.equal(result.uniqueEligibleCount, 1);
  assert.deepEqual(result.groups[0].items.map(item => item.id), ["good"]);
});

test("unmatched developments remain on the ordinary news feed, not assigned a fake topic", () => {
  const unknown = report("weather", "New weather forecast published",
    "Meteorological service issues a routine weather update.");
  const result = projectVerifiedNewsroom([unknown], now);
  assert.equal(result.uniqueEligibleCount, 1);
  assert.equal(result.unclassifiedCount, 1);
  assert.ok(result.groups.every(group => group.items.length === 0));
});

test("empty, invalid-time and bounded projections remain explicit", () => {
  const good = report("good", "AI coding agents increase model capability",
    "Original-source capability statement with required provenance.");
  assert.ok(projectVerifiedNewsroom([], now).groups.every(g => g.items.length === 0));
  assert.equal(projectVerifiedNewsroom([good], new Date("invalid")).asOf, "UNAVAILABLE");
  assert.ok(projectVerifiedNewsroom([good], new Date("invalid")).groups.every(g => g.items.length === 0));
  assert.ok(projectVerifiedNewsroom([good], now, 0).groups.every(g => g.items.length === 0));
  assert.equal(projectVerifiedNewsroom([good], now, 500).groups[0].items.length, 1);
});

test("UI contract stays source-led, accessible, private-agnostic and out of shared pages", () => {
  const component = readFileSync(new URL(
    "../components/blue-desk/NewsroomLensExplorer.tsx", import.meta.url,
  ), "utf8");
  assert.match(component, /"use client"/);
  assert.match(component, /role="group"/);
  assert.match(component, /aria-pressed/);
  assert.match(component, /data-newsroom-empty/);
  assert.match(component, /item\.sourceUrl/);
  assert.match(component, /item\.occurredAt/);
  assert.match(component, /item\.observedAt/);
  assert.doesNotMatch(component, /from .*supabase|createClient|story_thesis_versions|Gemini|openai/i);
});
