import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildCanonicalMarketMeasurements,
  type CanonicalMarketMeasurement,
} from "../lib/dossier-v2/canonical-market-crack-evidence.ts";
import type { MarketCrackSeries } from "../lib/dossier-v2/market-crack-observations.ts";

const dates: string[] = [];
for (let n = 0; n < 40 && dates.length < 21; n++) {
  const date = new Date(Date.UTC(2026, 8, 11 + n));
  if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;
  dates.push(date.toISOString().slice(0, 10));
}

const urls: Record<string, string> = {
  "hy-oas": "https://fred.stlouisfed.org/series/BAMLH0A0HYM2",
  "ig-oas": "https://fred.stlouisfed.org/series/BAMLC0A0CM",
  smh: "https://www.nasdaq.com/market-activity/etf/smh/historical",
  ndx: "https://www.nasdaq.com/market-activity/etf/qqq/historical",
  xlf: "https://www.nasdaq.com/market-activity/etf/xlf/historical",
  rsp: "https://www.nasdaq.com/market-activity/etf/rsp/historical",
  spx: "https://fred.stlouisfed.org/series/SP500",
};
const symbols: Record<string, string> = {
  "hy-oas": "BAMLH0A0HYM2", "ig-oas": "BAMLC0A0CM",
  smh: "SMH", ndx: "QQQ", xlf: "XLF", rsp: "RSP", spx: "SP500",
};
function series(id: string, from: number, to: number): MarketCrackSeries {
  const fred = id === "hy-oas" || id === "ig-oas";
  return {
    id, symbol: symbols[id], label: id, asOf: "2026-10-09", last: to,
    frequency: "daily",
    sourceName: fred ? "Federal Reserve Economic Data" : id === "spx"
      ? "S&P Dow Jones Indices via FRED" : "Nasdaq official etf history",
    sourceUrl: urls[id],
    points: dates.map((date, i) => ({
      time: Date.parse(date + "T00:00:00Z") / 1000,
      close: from + (to - from) * i / 20,
    })),
  };
}
function universe(): MarketCrackSeries[] {
  return [
    series("hy-oas", 3, 3.5), series("ig-oas", 1, 1.1),
    series("smh", 100, 110), series("ndx", 100, 105),
    series("xlf", 100, 90), series("spx", 100, 98),
    series("rsp", 100, 101),
  ];
}
const AS_OF = "2026-10-10T08:30:00Z";

test("derived market input can enter canonical chain only from exact approved provider identities", () => {
  const { items, gaps } = buildCanonicalMarketMeasurements(universe(), AS_OF, AS_OF);
  assert.equal(items.length, 5);
  assert.deepEqual(gaps, []);
  assert.ok(items.every((item) => item.sources.every((source) =>
    source.url.startsWith("https://fred.stlouisfed.org/")
    || source.url.startsWith("https://www.nasdaq.com/market-activity/"))));
  assert.ok(items.every((item) => item.asOf === "2026-10-09T23:59:59.999Z"));
  const hy = items.find((item) => item.id.startsWith("hy_oas_20s:"))!;
  assert.equal(hy.observedValue, 50);
  assert.equal(hy.unit, "basis_points");
  assert.equal(hy.sources[0].baseline, 3);
  assert.equal(hy.sources[0].latest, 3.5);
  const breadth = items.find((item) => item.id.startsWith("smh_qqq_20s:"))!;
  assert.equal(breadth.unit, "percentage_points");
  assert.equal(breadth.sources.length, 2);
  assert.match(breadth.claim, /price-return difference/);
  assert.doesNotMatch(breadth.claim, /total return/i);
});

test("content identity is deterministic, keyed to original values, measurement window and instruments", () => {
  const initial = buildCanonicalMarketMeasurements(universe(), AS_OF, AS_OF);
  const next = buildCanonicalMarketMeasurements(universe(), AS_OF, "2026-10-10T09:30:00Z");
  assert.deepEqual(next.items.map((item) => item.contentHash), initial.items.map((item) => item.contentHash));
  assert.equal(new Set(initial.items.map((item) => item.id)).size, 5);
  const changed = universe();
  changed.find((r) => r.id === "hy-oas")!.points![0].close = 3.1;
  const revision = buildCanonicalMarketMeasurements(changed, AS_OF, AS_OF);
  assert.notEqual(revision.items[0].contentHash, initial.items[0].contentHash);
});

test("stale or historical replay, unknown sources and stale provider prices never become canonical measurements", () => {
  assert.deepEqual(buildCanonicalMarketMeasurements(universe(), "2026-09-15T08:00:00Z", AS_OF).items, []);
  assert.deepEqual(buildCanonicalMarketMeasurements(universe(), "2026-10-15T08:00:00Z", AS_OF).items, []);
  assert.ok(buildCanonicalMarketMeasurements(universe(), "2026-10-20T08:00:00Z", "2026-10-20T08:00:00Z").items.length === 0);
  const spoof = universe();
  spoof.find((s) => s.id === "smh")!.sourceUrl = "https://example.com/smh";
  const result = buildCanonicalMarketMeasurements(spoof, AS_OF, AS_OF);
  assert.ok(!result.items.some((item) => item.id.startsWith("smh_qqq_20s:")));
  assert.ok(result.gaps.some((gap) => gap.includes("SOURCE_IDENTITY_OR_INPUT_INTEGRITY_UNVERIFIED")));
  const price = universe();
  price.find((s) => s.id === "xlf")!.points![0].close = -50;
  assert.ok(buildCanonicalMarketMeasurements(price, AS_OF, AS_OF).gaps.some((gap) =>
    gap.includes("xlf_spx_20s:INSUFFICIENT_MATCHED_SESSIONS")));
});

test("canonical write is an existing memory/Evidence UUID chain, never a parallel table", () => {
  const text = readFileSync(new URL("../lib/dossier-v2/canonical-market-crack-evidence.ts", import.meta.url), "utf8");
  assert.match(text, /persistSensorMemory\(/);
  assert.match(text, /\.from\("normalised_observations"\)/);
  assert.match(text, /\.from\("intelligence_evidence"\)/);
  assert.match(text, /normalised_observation_id: obs.id/);
  assert.match(text, /onConflict: "source_id,content_hash"/);
  assert.match(text, /CONFLICTING_SOURCE_REVISION_REQUIRES_ADJUDICATION/);
  assert.doesNotMatch(text, /\.from\("story_thesis_versions"\)|\.from\("stories"\)/);
  const manual = readFileSync(new URL("../lib/dossier-v2/manual-run.ts", import.meta.url), "utf8");
  assert.match(manual, /options.persist && !options.snapshotResult && !options.client/);
  assert.ok(manual.indexOf("persistCanonicalMarketMeasurements") < manual.indexOf("loadCanonicalCandidateSnapshot(client"));
});
