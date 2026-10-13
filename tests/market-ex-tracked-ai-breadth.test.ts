import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const market = readFileSync(new URL("../lib/market.ts", import.meta.url), "utf8");
const monitor = readFileSync(new URL("../lib/market-monitor.ts", import.meta.url), "utf8");
const dossier = readFileSync(new URL("../lib/dossier-v2/canonical-snapshot.ts", import.meta.url), "utf8");

function symbolsOf(name: string) {
  const pattern = new RegExp("const " + name + " = \\[([\\s\\S]*?)\\];");
  const match = market.match(pattern);
  assert.ok(match, "missing named source universe: " + name);
  return [...match[1].matchAll(/"([A-Z0-9-]+)"/g)].map((value) => value[1]);
}

test("new comparison is a subset of large-cap proxy minus the exact tracked AI basket", () => {
  const large = symbolsOf("LARGE_CAP_PROXY");
  const tracked = new Set(symbolsOf("AI_BASKET"));
  const exTracked = large.filter((symbol) => !tracked.has(symbol));
  assert.ok(exTracked.length >= 30);
  assert.ok(exTracked.length < large.length);
  assert.ok(exTracked.includes("JPM"));
  assert.ok(exTracked.includes("WMT"));
  assert.equal(exTracked.includes("NVDA"), false);
  assert.equal(exTracked.includes("MSFT"), false);
  assert.equal(new Set(exTracked).size, exTracked.length);
  assert.match(market, /const LARGE_CAP_EX_TRACKED_AI_PROXY = LARGE_CAP_PROXY\.filter\(\(symbol\) => !AI_BASKET\.includes\(symbol\)\)/);
});

test("existing breadth and pulse baselines stay ordered and unchanged", () => {
  const original = market.indexOf('breadthSnapshot(stockHistories, "large-cap",');
  const ai = market.indexOf('breadthSnapshot(stockHistories, "ai-basket",');
  const mag7 = market.indexOf('breadthSnapshot(stockHistories, "mag7",');
  const exAi = market.indexOf('"large-cap-ex-tracked-ai"');
  assert.ok(original > 0 && original < ai && ai < mag7 && mag7 < exAi);
  assert.match(market, /"US large-cap proxy · excluding tracked AI basket"/);
  assert.match(market, /pulseWeek: calculatePulse\(series, breadth\[0\], 5\)/);
  assert.match(market, /pulseMonth: calculatePulse\(series, breadth\[0\], 21\)/);
});

test("coverage and dates come only from the existing measured Nasdaq constituents", () => {
  assert.match(market, /breadthSnapshot\(histories: Map<string, PricePoint\[\]>, id: string, label: string, symbols: string\[\]\)/);
  assert.match(market, /const eligible = symbols\.filter\(\(symbol\) => \(histories\.get\(symbol\)\?\.length \|\| 0\) >= 221\)/);
  assert.match(market, /sampleSize: current\.sampleSize/);
  assert.match(market, /targetSize: symbols\.length/);
  assert.match(market, /sourceName: "Nasdaq official daily histories"/);
  assert.match(market, /breadth: market\?\.breadth \?\? \[\]/);
  assert.match(monitor, /breadth: market\?\.breadth \?\? \[\]/);
});

test("the Dossier receives a labelled noncanonical observation, not a live market verdict", () => {
  assert.match(dossier, /for \(const \[index, breadth\] of \(monitor\.breadth \?\? \[\]\)\.entries\(\)\)/);
  assert.match(dossier, /evidence_id: `market-breadth:\$\{breadth\.id\}:\$\{breadth\.current\.asOf\}`/);
  assert.match(dossier, /source_type: "MARKET_DATA"/);
  assert.match(dossier, /sample_size: breadth\.current\.sampleSize/);
  assert.match(dossier, /target_size: breadth\.targetSize/);
  assert.match(market, /This is not a full S&P 500 ex-AI index/);
  assert.doesNotMatch(market, /canonical_record_backed: true/);
});
