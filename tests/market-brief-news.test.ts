import assert from "node:assert/strict";
import test from "node:test";
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
