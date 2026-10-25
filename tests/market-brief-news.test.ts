import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { selectVerifiedNewsBriefs, type NewsBriefInput } from "../lib/market-brief-news.ts";

const now = new Date("2026-10-20T10:00:00Z");
const base: NewsBriefInput = {
  id: "event-1",
  headline: "Company reports an earnings increase",
  what_happened: "The company reported quarterly revenue and disclosed its latest guidance.",
  source_name: "Original verified financial report",
  source_url: "https://www.reuters.com/markets/companies/sample-earnings-2026/",
  source_kind: "reporting",
  verification_state: "VERIFIED",
  lifecycle_state: "MOTION",
  occurred_at: "2026-10-20T08:00:00Z",
  observed_at: "2026-10-20T08:10:00Z",
  expires_at: "2026-10-22T08:00:00Z",
};

test("a verified factual report is a News Brief without a new accepted Story", () => {
  const result = selectVerifiedNewsBriefs([base], now);
  assert.equal(result.length, 1);
  assert.equal(result[0].contentType, "NEWS_BRIEF");
  assert.equal(result[0].verification, "SOURCE_VERIFIED");
  assert.equal(result[0].sourceUrl, base.source_url);
  assert.equal("dossierId" in result[0], false);
  assert.equal("thesisVersionId" in result[0], false);
});

test("discovery, unverified interpretations, and creator reports are not public news", () => {
  const items = [
    { ...base, id: "lead", verification_state: "LEAD" },
    { ...base, id: "partial", verification_state: "PARTIAL" },
    { ...base, id: "creator", source_kind: "creator" },
    { ...base, id: "unknown", source_kind: "other" },
  ];
  assert.equal(selectVerifiedNewsBriefs(items, now).length, 0);
});

test("future, expired, process, homepage and insecure records are rejected", () => {
  const items = [
    { ...base, id: "future", occurred_at: "2026-10-21T10:00:00Z" },
    { ...base, id: "late-observed", observed_at: "2026-10-21T10:00:00Z" },
    { ...base, id: "expired", expires_at: "2026-10-20T09:00:00Z" },
    { ...base, id: "operational", headline: "Source audit and provider authentication update" },
    { ...base, id: "homepage", source_url: "https://www.reuters.com/" },
    { ...base, id: "http", source_url: "http://www.reuters.com/markets/companies/sample/" },
  ];
  assert.equal(selectVerifiedNewsBriefs(items, now).length, 0);
});

test("latest validated report comes first and caller data is not mutated", () => {
  const older = { ...base, id: "old", occurred_at: "2026-10-20T07:00:00Z" };
  const items = [older, base];
  const result = selectVerifiedNewsBriefs(items, now, 1);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, base.id);
  assert.equal(items[0].id, older.id);
});


test("source-verified News Brief still needs internally consistent observed and expiry times", () => {
  assert.equal(selectVerifiedNewsBriefs([
    { ...base, id: "before", observed_at: "2026-10-20T07:00:00Z" },
    { ...base, id: "expiry-before", expires_at: "2026-10-20T07:00:00Z" },
  ], now).length, 0);
});

test("a release from six days ago is not breaking news after late research verification", () => {
  const late = {
    ...base,
    id: "actual-sept-cpi",
    headline: "Consumer Price Index for September 2026 · Released",
    what_happened: "The US Bureau of Labor Statistics published its September headline and core inflation figures.",
    source_name: "U.S. Bureau of Labor Statistics",
    source_url: "https://www.bls.gov/news.release/archives/cpi_10142026.htm",
    source_kind: "official",
    occurred_at: "2026-10-14T12:00:00Z",
    observed_at: "2026-10-19T04:03:10Z",
    expires_at: "2026-10-21T04:03:10Z",
  };
  assert.equal(selectVerifiedNewsBriefs([late], now).length, 0,
    "Late detection and expiry extension never reset published-event freshness");
});

test("multiple Motion versions of the same original report yield one News Brief", () => {
  const duplicate = { ...base, id: "event-2" };
  const result = selectVerifiedNewsBriefs([base, duplicate], now);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, base.id);
});

test("News Brief reader independently searches verified items without Story admission", () => {
  const fs = readFileSync(new URL("../lib/market-motion.ts", import.meta.url), "utf8");
  const home = readFileSync(new URL("../app/blue-desk/page.tsx", import.meta.url), "utf8");
  assert.match(fs, /export async function getCurrentVerifiedMarketMotion/);
  assert.match(fs, /\.eq\("verification_state", "VERIFIED"\)/);
  assert.match(fs, /\.neq\("effective_state", "EXPIRED"\)/);
  assert.match(fs, /Math\.min\(24, options\.limit \?\? 12\)/);
  assert.match(home, /getCurrentVerifiedMarketMotion\(\{ limit: 24 \}\)/);
  assert.match(home, /selectVerifiedNewsBriefs\(verifiedMotions, now, 12\)/);
  assert.doesNotMatch(home, /getCurrentMarketMotion\(|getLiveDeskHomepageDailyBrief/);
});
