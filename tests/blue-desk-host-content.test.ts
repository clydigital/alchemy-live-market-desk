import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { blueDeskPublicHref } from "../lib/blue-desk-host.ts";

test("Bluebelly homepage and calendar use clean public URLs", () => {
  assert.equal(blueDeskPublicHref("/blue-desk", "bluebelly-desk.vercel.app"), "/");
  assert.equal(
    blueDeskPublicHref("/blue-desk/calendar?window=30d", "bluebelly-desk.vercel.app"),
    "/calendar?window=30d",
  );
  assert.equal(
    blueDeskPublicHref("/blue-desk/stories/article%3A123?edition=abc", "bluebelly-desk.vercel.app"),
    "/stories/article%3A123?edition=abc",
  );
});

test("Legacy domain, third-party hosts and internal routes are unchanged", () => {
  for (const host of [
    "alchemy-live-market-desk.vercel.app",
    "alchemy-blue-desk.vercel.app",
    "attacker.vercel.app",
  ]) {
    assert.equal(blueDeskPublicHref("/blue-desk", host), "/blue-desk");
    assert.equal(blueDeskPublicHref("/blue-desk/calendar", host), "/blue-desk/calendar");
  }
  assert.equal(blueDeskPublicHref("/api/presenter-calendar", "bluebelly-desk.vercel.app"), "/api/presenter-calendar");
  assert.equal(blueDeskPublicHref("//evil.invalid", "bluebelly-desk.vercel.app"), "//evil.invalid");
});

test("Next hostname rewrites are limited to Bluebelly routes, never API or legacy roots", () => {
  const config = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");
  assert.match(config, /bluebelly-desk\.vercel\.app/);
  for (const source of ['source: "/"', 'source: "/calendar"', 'source: "/stories/:articleId"']) {
    assert.ok(config.includes(source), "missing expected presentation rewrite: " + source);
  }
  assert.ok(!config.includes('source: "/api'), "No API rewrite may be added");
});

test("Story detail is pinned to exact edition, with no latest-edition fallback", () => {
  const detail = readFileSync(new URL("../app/blue-desk/stories/[articleId]/page.tsx", import.meta.url), "utf8");
  assert.match(detail, /snapshots\.find\(snapshot => snapshot\.id === edition\)/);
  assert.match(detail, /if \(!frozen\) notFound\(\)/);
  assert.match(detail, /item\.articleId === articleId && item\.editionId === edition/);
  assert.match(detail, /httpsSource\(source\.url\)/);
});
