import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { diagnoseCurrentRunOriginalNewsCoverage } from "../lib/market-motion-original-news-coverage.ts";

const now = new Date("2026-10-22T00:00:00Z");
const intake = [
  { itemType: "news", publishedAt: "2026-10-21T13:00:00Z",
    url: "https://www.example.com/markets/some-factual-news" },
  { itemType: "news", publishedAt: "2026-10-21T11:30:00Z",
    url: "https://www.example.com/markets/another-report" },
];

test("fresh reporting without original admission emits a bounded research-source gap", () => {
  const warning = diagnoseCurrentRunOriginalNewsCoverage(intake, [
    { sourceKind: "reporting", verificationState: "REPORTED",
      occurredAt: "2026-10-21T13:00:00Z" },
    { sourceKind: "creator", verificationState: "LEAD",
      occurredAt: "2026-10-21T13:05:00Z" },
  ], now);
  assert.deepEqual(warning, [
    "CURRENT_RUN_ORIGINAL_VERIFIED_NEWS_GAP: fresh_news=2; reported_motion_candidates=1; original_verified_motion_candidates=0",
  ]);
  assert.ok(warning.every(text => !text.includes("www.example.com")));
});

test("genuine fresh admitted primary fact clears gap but a stale official item does not", () => {
  const fresh = {
    sourceKind: "official", verificationState: "VERIFIED",
    occurredAt: "2026-10-21T12:00:00Z",
  };
  assert.deepEqual(diagnoseCurrentRunOriginalNewsCoverage(intake, [fresh], now), []);
  assert.equal(diagnoseCurrentRunOriginalNewsCoverage(intake, [
    {...fresh,occurredAt:"2026-10-14T12:00:00Z"},
  ],now).length,1);
  assert.equal(diagnoseCurrentRunOriginalNewsCoverage(intake, [
    {...fresh,verificationState:"REPORTED"},
  ],now).length,1);
});

test("scheduled events, creator-only videos and stale or invalid URLs do not count as fresh news", () => {
  assert.deepEqual(diagnoseCurrentRunOriginalNewsCoverage([
    {itemType:"video",publishedAt:"2026-10-21T10:00:00Z",url:"https://youtu.be/abc"},
    {itemType:"news",publishedAt:"2026-10-14T00:00:00Z",url:"https://example.org/old"},
    {itemType:"news",publishedAt:"2026-10-21T13:00:00Z",url:"https://example.com/"},
    {itemType:"news",publishedAt:"2026-10-23T13:00:00Z",url:"https://example.com/future"},
  ],[],now),[]);
  assert.deepEqual(diagnoseCurrentRunOriginalNewsCoverage([], [], now), []);
  assert.deepEqual(diagnoseCurrentRunOriginalNewsCoverage(intake, [], new Date("bad date")), [
    "CURRENT_NEWS_COVERAGE_CLOCK_INVALID",
  ]);
});

test("real scheduled Motion ingestion diagnoses source coverage without admitting creator facts", () => {
  const source = readFileSync(new URL("../lib/market-motion-ingestion.ts", import.meta.url), "utf8");
  const publication = readFileSync(new URL("../lib/market-brief-news.ts", import.meta.url), "utf8");
  const handler = readFileSync(new URL("../app/api/research-update/route.ts", import.meta.url), "utf8");
  assert.match(source,/warnings\.push\(\.\.\.diagnoseCurrentRunOriginalNewsCoverage\(input\.items, candidates, now\)\)/);
  assert.match(publication,/verification_state !== "VERIFIED"/);
  assert.match(publication,/NEWS_BRIEF_EVENT_MAX_AGE_MS/);
  assert.match(handler,/persistMarketMotionFromResearchRun/);
  assert.match(handler,/marketMotion\.warnings/);
});
