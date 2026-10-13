import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const view = readFileSync(new URL("../components/live-desk/MarketsMonitor.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../components/live-desk/markets-monitor.module.css", import.meta.url), "utf8");
const monitor = readFileSync(new URL("../lib/market-monitor.ts", import.meta.url), "utf8");

test("all breadth categories render with dated source values and actual coverage", () => {
  assert.match(view, /monitor\.breadth\.map\(\(snapshot\) =>/);
  assert.match(view, /snapshot\.label/);
  assert.match(view, /snapshot\.current\.asOf \?\? "UNAVAILABLE"/);
  assert.match(view, /snapshot\.current\.sampleSize/);
  assert.match(view, /snapshot\.targetSize/);
  assert.match(view, /snapshot\.current\.above50\.toFixed\(0\)/);
  assert.match(view, /snapshot\.current\.above200\.toFixed\(0\)/);
  assert.match(view, /snapshot\.weekAgo\.sampleSize > 0/);
  assert.match(css, /\.breadthTableWrap\{overflow-x:auto\}/);
});

test("sparse or missing samples never render a misleading zero-percent breadth result", () => {
  assert.match(view, /const hasDate = Boolean\(snapshot\.current\.asOf\)/);
  assert.match(view, /snapshot\.current\.sampleSize >= Math\.max\(10, Math\.ceil\(snapshot\.targetSize \* 0\.6\)\)/);
  assert.match(view, /sufficientlyCovered \? `\$\{snapshot\.current\.above50\.toFixed\(0\)\}%` : "—"/);
  assert.match(view, /data-coverage=\{sufficientlyCovered \? "measured" : "insufficient"\}/);
});

test("ex-tracked-AI lens and canonical independence are plainly labelled", () => {
  assert.match(view, /snapshot\.id === "large-cap-ex-tracked-ai"/);
  assert.match(view, /Excludes only tracked AI basket names; not the full S&amp;P 500 ex-AI universe/);
  assert.match(view, /These comparisons do not change the canonical Dossier verdict/);
  assert.match(view, /not an official S&amp;P index calculation/);
  assert.doesNotMatch(view, /persistCanonicalMarketMeasurements|persistMarketDossierV2|runIntelligenceEngine/);
  assert.match(monitor, /breadth: market\?\.breadth \?\? \[\]/);
});
