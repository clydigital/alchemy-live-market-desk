import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const strip = readFileSync(
  new URL("../components/live-desk/MarketRegimeStrip.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../components/live-desk/market-regime-strip.module.css", import.meta.url),
  "utf8",
);

test("homepage surfaces the canonical Regime and Story arrays in horizontally scrollable lanes", () => {
  assert.match(page, /<MarketRegimeStrip/);
  assert.match(page, /regimes=\{regimes\}/);
  assert.match(page, /stories=\{stories\.map/);
  assert.match(strip, /href=\{"\/regimes\/"/);
  assert.match(strip, /href=\{"\/stories\/"/);
  assert.match(strip, /orderedRegimes/);
  assert.match(strip, /scrollBy\(/);
  assert.match(styles, /overflow-x: auto/);
  assert.match(styles, /scroll-snap-type: x mandatory/);
  assert.match(strip, /aria-labelledby="home-market-regimes"/);
  assert.match(strip, /aria-labelledby="home-persistent-stories"/);
});

test("fresh verified primary Motion can be spotlighted without claiming canonical acceptance", () => {
  assert.match(page, /item\.attentionTier === "PRIMARY"/);
  assert.match(page, /item\.verificationState === "VERIFIED"/);
  assert.match(page, /Date\.now\(\) - eventAt <= 48 \* 60 \* 60 \* 1000/);
  assert.match(strip, /NOT A REGIME DECISION/);
  assert.match(strip, /href="\/whats-new"/);
  assert.match(strip, /sourceKind === "dossier_motion"/);
  assert.match(strip, /System 2 Dossier context · non-state/);
});

test("scrolling is manual, keyboard-reachable and respects reduced-motion settings", () => {
  assert.match(strip, /tabIndex=\{0\}/);
  assert.match(strip, /prefers-reduced-motion: reduce/);
  assert.match(strip, /Scroll regimes forward/);
  assert.match(strip, /Scroll Stories backward/);
  assert.doesNotMatch(strip, /setInterval|setTimeout/);
});
