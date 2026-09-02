import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { recruitFreshNews } from "../lib/fresh-news-recruitment.ts";

test("G20 global bond-yield news is recruited as fresh cross-market evidence", () => {
  const now = new Date("2026-09-02T01:15:00.000Z");
  const result = recruitFreshNews({
    title: "What higher interest rates are telling us",
    summary: "At the G20 meeting, Treasury Secretary Scott Bessent said the global bond sell-off reflects stronger growth. Japan's 10-year yield hit 3% for the first time in three decades while finance ministers debated deficits and fiscal sustainability.",
    publishedAt: "2026-09-01T16:10:05.000Z",
  }, now);

  assert.ok(result.categories.includes("rates_sovereigns"));
  assert.ok(result.categories.includes("central_banks_policy"));
  assert.ok(result.categories.includes("macro"));
  assert.ok(result.affectedAssets.includes("JP10Y"));
  assert.ok(result.relevance >= 90, `expected high relevance, got ${result.relevance}`);
  assert.ok(result.materiality >= 90, `expected high materiality, got ${result.materiality}`);
  assert.ok(result.novelty >= 90, `expected fresh novelty, got ${result.novelty}`);
});

test("generic business feed item does not inherit a high market score from its publisher", () => {
  const now = new Date("2026-09-02T01:15:00.000Z");
  const result = recruitFreshNews({
    title: "Company opens a new regional office",
    summary: "The company announced a new office and local hiring plans.",
    publishedAt: "2026-09-01T22:00:00.000Z",
  }, now);

  assert.ok(result.relevance < 70);
  assert.ok(result.materiality < 70);
  assert.equal(result.marketLinked, false);
});

test("unreleased high-impact calendar entries are Ahead-only rather than current evidence", () => {
  const source = readFileSync(new URL("../lib/high-impact-calendar-intake.ts", import.meta.url), "utf8");
  assert.match(source, /recommendedAction:\s*released\s*\?\s*"collect_evidence"\s*as const\s*:\s*"ignore"\s*as const/);
  assert.match(source, /Ahead only:/);
  assert.match(source, /novelty:\s*released\s*\?\s*94\s*:\s*20/);
});
