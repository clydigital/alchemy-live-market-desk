import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("app/blue-desk/market-first-home.module.css", "utf8");
const page = readFileSync("app/blue-desk/page.tsx", "utf8");

test("all three Bluebelly header radars share exactly one moving sweep and no fixed spokes", () => {
  const shared = readFileSync("components/blue-desk/radar-sweep.module.css", "utf8");
  const watch = readFileSync("components/blue-desk/lean-watch.module.css", "utf8");
  const learn = readFileSync("app/blue-desk/learn/learn.module.css", "utf8");
  assert.doesNotMatch(css, /conic-gradient/);
  assert.doesNotMatch(watch, /conic-gradient/);
  assert.doesNotMatch(learn, /\.orbitOuter::(?:before|after)/);
  assert.equal((shared.match(/conic-gradient\(/g) ?? []).length, 1);
  assert.match(shared, /\.sweep\{[^}]+bb-radar-sweep var\(--radar-period,8s\) linear infinite/);
  assert.match(shared, /prefers-reduced-motion:reduce\)\{\.sweep\{animation:none;opacity:0\}/);
  assert.match(css, /prefers-reduced-motion:reduce\)\{\s*\.orbitNodeA,\.orbitNodeB,\.orbitNodeC\{animation:none\}/);
  for (const source of [page, readFileSync("components/blue-desk/LeanWatch.tsx", "utf8"), readFileSync("app/blue-desk/learn/page.tsx", "utf8")]) {
    assert.equal((source.match(/<RadarSweep\/>/g) ?? []).length, 1);
  }
});

test("shortcut pulses peak at the sweep head and lead to their respective pages", () => {
  const entries = [["A", "/markets", "MARKETS"], ["B", "/calendar", "CATALYSTS"], ["C", "/key-stories", "WATCH"]] as const;
  for (const [node, href, label] of entries) {
    const rule = css.match(new RegExp(`\\.orbitNode${node}\\{left:([\\d.]+)%;top:([\\d.]+)%;animation-delay:calc\\(var\\(--radar-period\\) \\* (-[\\d.]+)\\)\\}`));
    assert.ok(rule, label);
    const [, x, y, delay] = rule;
    const angle = Math.atan2(Number(x) - 50, 50 - Number(y)) * 180 / Math.PI;
    const headAtPeak = -93 + (1.02 + Number(delay)) % 1 * 360;
    const error = ((headAtPeak - angle + 540) % 360) - 180;
    assert.ok(Math.abs(error) < 2, `${label} sweep alignment: ${error}°`);
    assert.ok(page.includes(`<Link className={marketHome.orbitNode${node}} href="${href}">${label}</Link>`));
  }
  assert.match(css, /\.orbitNodeA,\.orbitNodeB,\.orbitNodeC\{[^}]+bb-home-radar-contact var\(--radar-period\) linear infinite/);
  assert.doesNotMatch(css.match(/\.orbitNodeA:hover,\.orbitNodeB:hover,\.orbitNodeC:hover\{([^}]+)\}/)![1], /animation/);
});
