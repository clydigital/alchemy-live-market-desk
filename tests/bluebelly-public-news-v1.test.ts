import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { blueDeskHostAccess } from "../lib/blue-desk-host.ts";
import {
  BLUEBELLY_PUBLIC_NEWS_VERSION,
  projectBluebellyPublicNews,
} from "../lib/bluebelly-public-news-v1.ts";
import type { NewsBriefV1 } from "../lib/market-brief-news.ts";

const now = new Date("2026-10-27T04:00:00.000Z");
const eventAt = "2026-10-26T12:00:00.000Z";
const item: NewsBriefV1 = {
  contractVersion: "news-brief/1",
  contentType: "NEWS_BRIEF",
  id: "d7467662-bc97-40e2-9004-a111b9183c0d",
  headline: "Central bank publishes updated monetary policy statement",
  summary: "The central bank released a dated policy statement; any price response requires a separate market observation.",
  sourceName: "Central bank",
  sourceUrl: "https://www.example.org/press/policy-statement",
  sourceKind: "official",
  occurredAt: eventAt,
  observedAt: "2026-10-26T12:05:00.000Z",
  verification: "SOURCE_VERIFIED",
};

test("public-news/1 carries only attributed source facts and never source internals", () => {
  const contaminated = {
    ...item,
    secrets: "INTERNAL_ONLY_MARKER",
    diagnostics: { private: "INTERNAL_ONLY_MARKER" },
    memory: [{ creatorTranscript: "INTERNAL_ONLY_MARKER" }],
    sourceReceipt: { auth: "INTERNAL_ONLY_MARKER" },
    canonical: { thesisVersion: "INTERNAL_ONLY_MARKER" },
  };
  const got = projectBluebellyPublicNews([contaminated], now);
  assert.equal(got.length, 1);
  assert.deepEqual(Object.keys(got[0]).sort(), [
    "id", "headline", "summary", "sourceName", "sourceUrl", "sourceKind",
    "occurredAt", "observedAt", "verification", "authority",
  ].sort());
  assert.equal(got[0].authority, "FACTUAL_NEWS_NOT_CANONICAL_STORY");
  assert.equal(got[0].verification, "SOURCE_VERIFIED");
  assert.equal(got[0].sourceUrl, item.sourceUrl);
  assert.doesNotMatch(JSON.stringify(got), /INTERNAL_ONLY_MARKER/);
  assert.equal(BLUEBELLY_PUBLIC_NEWS_VERSION, "bluebelly-public-news/1");
});

test("unverified, stale, future, malformed and insecure claims fail closed", () => {
  const disallowed: NewsBriefV1[] = [
    { ...item, verification: "REPORTED" as NewsBriefV1["verification"] },
    { ...item, contentType: "STORY" as NewsBriefV1["contentType"] },
    { ...item, contractVersion: "raw-evidence/1" as NewsBriefV1["contractVersion"] },
    { ...item, sourceUrl: "http://www.example.org/press" },
    { ...item, sourceUrl: "https://admin:pw@example.org/press" },
    { ...item, sourceUrl: "https://www.example.org/" },
    { ...item, occurredAt: "2026-10-24T03:00:00.000Z" },
    { ...item, occurredAt: "2026-10-28T01:00:00.000Z" },
    { ...item, observedAt: "2026-10-28T01:00:00.000Z" },
    { ...item, observedAt: "2026-10-26T11:00:00.000Z" },
    { ...item, sourceKind: "creator" },
    { ...item, id: "unknown" },
  ];
  for (const row of disallowed) {
    assert.deepEqual(projectBluebellyPublicNews([row], now), [], row.sourceUrl);
  }
  assert.deepEqual(projectBluebellyPublicNews([item], new Date("invalid")), []);
  assert.deepEqual(projectBluebellyPublicNews([item], now, Number.NaN), []);
});

test("repeated reports cannot inflate counts; public feed size bounded to 12", () => {
  assert.equal(projectBluebellyPublicNews([item, item], now).length, 1);
  const many = Array.from({ length: 20 }, (_, i) => ({
    ...item,
    id: "d7467662-bc97-40e2-9004-" + String(i).padStart(12, "0"),
    headline: item.headline + " " + i,
  }));
  assert.equal(projectBluebellyPublicNews(many, now, 500).length, 12);
  assert.equal(projectBluebellyPublicNews(many, now, -2).length, 0);
});

test("only the exact public-news route is visible on the Bluebelly hostname", () => {
  const path = "/api/blue-desk/v1/public-news";
  assert.equal(blueDeskHostAccess(path, "bluebelly-desk.vercel.app"), "public");
  for (const bad of [path + "/", path + "/private",
    "/api/blue-desk/v1/private", "/api/hybrid-feed-v2",
    "/api/dossier-v2", "/api/internal/canonical-feed",
    "/api/owner/automated-report-pdf"]) {
    assert.notEqual(blueDeskHostAccess(bad, "bluebelly-desk.vercel.app"), "public", bad);
  }
  assert.notEqual(blueDeskHostAccess(path, "alchemy-blue-desk.vercel.app"), "public");
  assert.notEqual(blueDeskHostAccess(path, "alchemy-live-market-desk.vercel.app"), "public");
  assert.notEqual(blueDeskHostAccess(path, "preview-random.vercel.app"), "public");
});

test("public-news route reuses existing verified inputs, not raw legacy feeds", () => {
  const route = readFileSync(
    new URL("../app/api/blue-desk/v1/public-news/route.ts", import.meta.url), "utf8");
  assert.match(route, /getCurrentVerifiedMarketMotion/);
  assert.match(route, /selectVerifiedNewsBriefs/);
  assert.match(route, /getOriginalPressNews/);
  assert.match(route, /combineQualifiedNews/);
  assert.match(route, /projectBluebellyPublicNews/);
  assert.match(route, /BLUEBELLY_PRESENTATION_HOST/);
  assert.match(route, /X-Content-Type-Options/);
  assert.match(route, /Cache-Control.*no-store/);
  assert.doesNotMatch(route, /getCanonicalPublicationPayload|getDossierV2PresentationSelection/);
  assert.doesNotMatch(route, /hybrid-feed-v2|DASHBOARD_AUTH_REQUIRED|Authorization: Bearer/);
  assert.doesNotMatch(route, /\.insert\(|\.upsert\(|\.update\(/);
});
