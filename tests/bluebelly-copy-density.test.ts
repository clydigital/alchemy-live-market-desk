import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Bluebelly keeps sources, date information and status without repetitive process explanations", () => {
  const markets = source("app/blue-desk/markets/page.tsx");
  const calendar = source("app/blue-desk/calendar/page.tsx");
  const home = source("app/blue-desk/page.tsx");
  assert.match(markets, /row\.sourceUrl/);
  assert.match(markets, /sourceLabel\(row\)/);
  assert.match(markets, /Changes: rates in bp/);
  assert.doesNotMatch(markets, /not a causal explanation, trading signal/);
  assert.match(calendar, /Scheduled time, not verified publication time/);
  assert.match(home, /VERIFIED NEWS/);
  assert.doesNotMatch(home, /A quiet feed is not a Regime conclusion/);
});

test("Hybrid and Presenter Prep have compact visual cards but retain provenance", () => {
  const shelf = source("components/blue-desk/MarketGraphicsShelf.tsx");
  const prep = source("app/hybrid-output/prepare/page.tsx");
  assert.match(shelf, /Copy SVG/);
  assert.match(shelf, /canvas\.toBlob/);
  assert.doesNotMatch(shelf, /These are empty analytical frameworks/);
  assert.doesNotMatch(shelf, /<p>\{item\.description\}<\/p>/);
  assert.match(prep, /projection\.pinned/);
  assert.match(prep, /item\.asOf/);
  assert.match(prep, /claim\.sourceUrl/);
  assert.match(prep, /Price reaction unverified/);
  assert.doesNotMatch(prep, /This page does not replace the original analysis/);
});
