import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { upsertOfficialCpiMetrics } from "../lib/macro/official-actuals.ts";
import { StoredEconomicConsensusProvider } from "../lib/macro-consensus.ts";
import { assessCpiReleaseCoverage } from "../lib/macro/cpi-coverage-health.ts";

const RELEASE = "us-bls-2026-10-14-cpi-september-2026";
const RELEASE_AT = "2026-10-14T12:30:00.000Z";
const METRIC_KEYS = ["cpi_headline_mom", "cpi_headline_yoy", "cpi_core_mom", "cpi_core_yoy"] as const;
const actuals = [0.6, 3.7, 0.3, 2.6];
const consensus = [0.6, 3.6, 0.2, 2.5];

function metrics(capturedAt: string) {
  return METRIC_KEYS.map((key, i) => ({
    release_id: RELEASE,
    metric_key: key,
    label: key,
    actual: actuals[i],
    consensus: consensus[i],
    consensus_source: "https://example.com/preview",
    consensus_captured_at: capturedAt,
    forecast_low: null,
    forecast_high: null,
  }));
}
function source(k: string, at: string, tags = ["CPI_REACTION"]) {
  return {
    id: "uuid-" + k,
    event_at: at,
    available_at: "2026-10-15T02:53:17Z",
    affected_topics: tags,
    structured_payload: { evidenceNature: "verified_macro_data", signalKind: k },
  };
}

test("scheduled CPI guard flags pre-release missing forecasts and never invents their value", () => {
  const result = assessCpiReleaseCoverage(
    [{ id: RELEASE, release_date: RELEASE_AT, actual: null }],
    [], [],
    new Date("2026-10-13T12:00:00Z"),
  );
  assert.equal(result.status, "DEGRADED");
  assert.equal(result.checks[0]?.stage, "BEFORE_RELEASE");
  assert.deepEqual(result.checks[0]?.missing,
    METRIC_KEYS.map((key) => "PRE_RELEASE_CONSENSUS:" + key));
});

test("post-release retrospectives do NOT count as pre-release snapshots", () => {
  const result = assessCpiReleaseCoverage(
    [{ id: RELEASE, release_date: RELEASE_AT, actual: "Headline CPI +0.6% m/m" }],
    metrics("2026-10-15T02:54:25Z"),
    [source("economic_release", "2026-10-14T12:30:00Z"),
     source("rate_expectation", "2026-10-14T12:40:16Z"),
     source("market_reaction", "2026-10-14T12:40:16Z")],
    new Date("2026-10-15T03:00:00Z"),
  );
  assert.equal(result.status, "DEGRADED");
  assert.equal(result.checks[0]?.missing.length, 4);
  assert.deepEqual(result.checks[0]?.verifiedEvidenceIds.length, 3);
});

test("the release is COMPLETE only with four pre-release forecasts, four BLS actuals and timestamped reaction", () => {
  const candidate = {
    id: RELEASE, release_date: RELEASE_AT, actual: "Headline CPI +0.6% m/m",
  };
  const evidence = [
    source("economic_release", "2026-10-14T12:30:00Z", ["US_INFLATION"]),
    source("rate_expectation", "2026-10-14T12:40:16Z"),
    source("market_reaction", "2026-10-14T12:40:16Z"),
  ];
  const complete = assessCpiReleaseCoverage([candidate], metrics("2026-10-13T15:00:00Z"),
    evidence, new Date("2026-10-15T03:00:00Z"));
  assert.equal(complete.status, "OK");
  assert.deepEqual(complete.checks[0]?.missing, []);

  const stale = assessCpiReleaseCoverage([candidate], metrics("2026-10-13T15:00:00Z"),
    [evidence[0], evidence[1], source("market_reaction", "2026-10-14T12:20:00Z")],
    new Date("2026-10-15T03:00:00Z"));
  assert.ok(stale.checks[0]?.missing.includes("CANONICAL_CPI_EVIDENCE:market_reaction"));
});

test("CPI consensus provider refuses retrospectively collected values and requires all four metrics", async () => {
  const rows = metrics("2026-10-15T02:54:25Z");
  const client = {
    from(table: string) {
      return {
        select() {
          return {
            eq(_column: string, id: string) {
              if (table === "macro_releases") return {
                async maybeSingle() {
                  return { data: { id, release_date: RELEASE_AT }, error: null };
                },
              };
              return Promise.resolve({ data: rows, error: null });
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  const provider = new StoredEconomicConsensusProvider(client);
  const post = await provider.getEventSnapshot(RELEASE);
  assert.equal(post?.pointInTimeAvailable, false);
  assert.match(post?.coverageGap ?? "", /pre-release/);
  const historical = await provider.getPointInTimeSnapshot(RELEASE, "2026-10-14T12:29:00Z");
  assert.equal(historical?.metrics.length, 0);
  assert.equal(historical?.pointInTimeAvailable, false);
  for (const row of rows) row.consensus_captured_at = "2026-10-13T15:00:00Z";
  const correctlyCaptured = await provider.getPointInTimeSnapshot(RELEASE, "2026-10-14T12:29:00Z");
  assert.equal(correctlyCaptured?.pointInTimeAvailable, true);
  rows[0].consensus_source = "";
  const partial = await provider.getEventSnapshot(RELEASE);
  assert.equal(partial?.pointInTimeAvailable, false);
  assert.match(partial?.coverageGap ?? "", /cpi_headline_mom/);
});

test("re-ingesting CPI metrics preserves pre-release forecast values and capture clocks", async () => {
  const before = metrics("2026-10-13T15:00:00Z").map((metric) => ({ ...metric }));
  const actualUpdates: Record<string, unknown>[] = [];
  const client = {
    from(name: string) {
      assert.equal(name, "macro_release_metrics");
      return {
        async upsert(rows: Record<string, unknown>[], options: Record<string, unknown>) {
          assert.deepEqual(options, { onConflict: "release_id,metric_key", ignoreDuplicates: true });
          assert.ok(rows.every((row) => !("consensus" in row)
            && !("consensus_source" in row) && !("consensus_captured_at" in row)));
          return { error: null };
        },
        update(payload: Record<string, unknown>) {
          assert.equal("consensus" in payload, false);
          assert.equal("consensus_source" in payload, false);
          assert.equal("consensus_captured_at" in payload, false);
          actualUpdates.push(payload);
          const chain = {
            eq(_column: string, _value: string) { return chain; },
            then(resolve: (value: { error: null }) => unknown) {
              return Promise.resolve(resolve({ error: null }));
            },
          };
          return chain;
        },
      };
    },
  } as unknown as SupabaseClient;
  const count = await upsertOfficialCpiMetrics(client as ReturnType<typeof import("../lib/supabase/admin.ts").createSupabaseAdminClient>,
    {
      id: RELEASE, release_name: "Consumer Price Index for September 2026",
      release_date: RELEASE_AT, reference_period: "September 2026",
      actual: null, status: "completed",
      agency: "BLS", source_url: "https://www.bls.gov/news.release/archives/cpi_10142026.htm",
    },
    { actual: "Headline CPI +0.6% m/m; +3.7% y/y; Core +0.3% m/m; +2.6% y/y",
      sourceUrl: "https://www.bls.gov/news.release/archives/cpi_10142026.htm" },
    "2026-10-15T03:00:00Z");
  assert.equal(count, 4);
  assert.equal(actualUpdates.length, 4);
  assert.ok(before.every((metric) => metric.consensus_captured_at === "2026-10-13T15:00:00Z"));
});
