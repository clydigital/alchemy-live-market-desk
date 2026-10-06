import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const engine = readFileSync(new URL("../lib/regime-engine.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/regimes/page.tsx", import.meta.url), "utf8");

test("Regime health exposes unassigned active Story count and age from governed routing debt", () => {
  assert.match(engine, /unassignedStoryCount: number/);
  assert.match(engine, /highSeverityUnassignedStoryCount: number/);
  assert.match(engine, /oldestUnassignedOpenedAt: string \| null/);
  assert.match(engine, /oldestUnassignedAgeMinutes: number \| null/);
  assert.match(engine, /\.from\("research_debt"\)/);
  assert.match(engine, /\.eq\("status", "open"\)/);
  assert.match(engine, /\.like\("debt_key", "regime-routing:%"\)/);
  assert.match(engine, /\.eq\("metadata->>kind", "regime_routing_debt"\)/);
  assert.match(engine, /\.order\("opened_at", \{ ascending: true \}\)/);
});

test("Regime board makes open routing debt visible without implying a fallback route", () => {
  assert.match(page, /Unassigned active Stories/);
  assert.match(page, /Story routing debt is open/);
  assert.match(page, /high\/critical/);
  assert.match(page, /oldest open/);
  assert.match(page, /not forced into a weak Regime mapping/);
});
