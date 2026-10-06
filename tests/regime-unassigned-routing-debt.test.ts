import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtime = readFileSync(new URL("../lib/regime-engine.ts", import.meta.url), "utf8");
const routing = readFileSync(new URL("../lib/regimes.ts", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/20261007003500_regime_unassigned_routing_debt.sql", import.meta.url),
  "utf8",
);

test("Regime projector records unrouted Stories as routing debt without forcing a route", () => {
  assert.match(runtime, /sync_regime_routing_debt_v1/);
  assert.match(runtime, /p_considered_story_ids: input\.stories\.map\(\(story\) => story\.id\)/);
  assert.match(runtime, /p_routed_story_ids: input\.routedStoryIds/);
  assert.match(runtime, /active Story routing debt item\(s\) remain unassigned; no weak Regime mapping was forced/);

  assert.match(migration, /insert into public\.research_debt/);
  assert.match(migration, /'routingStatus', 'unassigned'/);
  assert.match(migration, /'contractVersion', 'regime-routing-debt\/1'/);
  assert.doesNotMatch(migration, /create table/i);
});

test("stale Regime routing ownership includes legitimate zero-link projections", () => {
  assert.match(
    migration,
    /select max\(run\.started_at\)[\s\S]*from public\.market_regime_projection_runs run[\s\S]*run\.projection_mode = 'shadow'/,
  );
  assert.doesNotMatch(
    migration.match(/create or replace function public\.sync_market_regime_story_links_v1[\s\S]*?\$\$;/)?.[0] ?? "",
    /join public\.market_regime_story_links/,
  );
  assert.match(runtime, /if \(routingDebt\.stale\)/);
  assert.match(runtime, /Stale Regime shadow worker stopped before projection persistence/);
});

test("routing restoration resolves existing routing debt instead of creating parallel state", () => {
  assert.match(migration, /status = 'resolved'/);
  assert.match(migration, /A governed Regime route was restored by projection/);
  assert.match(migration, /debt\.story_id = any\(v_routed\)/);
  assert.match(migration, /on conflict \(debt_key\) where status = 'open'/);
});


test("routing semantics are versioned into projection identity", () => {
  assert.match(routing, /REGIME_ROUTING_CONTRACT_VERSION = "regime-routing\/1"/);
  assert.match(runtime, /routingContractVersion: REGIME_ROUTING_CONTRACT_VERSION/);
});

test("idempotent Regime reuse reconciles debt only from persisted active links", () => {
  const reusedStart = runtime.indexOf("if (begun.reused) {");
  const reusedEnd = runtime.indexOf("\n  try {", reusedStart);
  assert.ok(reusedStart >= 0 && reusedEnd > reusedStart);

  const reused = runtime.slice(reusedStart, reusedEnd);
  assert.match(reused, /loadPersistedRoutedStoryIds\(/);
  assert.match(reused, /reconcileRegimeRoutingDebt\(/);
  assert.match(reused, /projectionRunId: begun\.row\.id/);
  assert.match(reused, /stories: source\.stories/);
  assert.match(reused, /routedStoryIds/);
  assert.match(reused, /reused: true/);
  assert.match(reused, /newer shadow run owns routing state/);
  assert.doesNotMatch(reused, /buildRegimeProjection\(/);
  assert.doesNotMatch(reused, /storyRoutes\(/);
});

test("persisted-route reconciliation reads only active Story links", () => {
  assert.match(runtime, /from\("market_regime_story_links"\)[\s\S]*select\("story_id"\)[\s\S]*\.is\("effective_to", null\)/);
});
