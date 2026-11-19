import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RADAR_BLIPS, radarBlipPosition } from "../lib/bluebelly-radar-blips.ts";

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

test("radar highlights share the scanner head colour and linger twice as long after contact", () => {
  const scanner = readFileSync("components/blue-desk/radar-sweep.module.css", "utf8");
  assert.match(scanner, /transparent 0deg 256\.5deg/); // 103.5°: 15% wider than 90°.
  assert.match(scanner, /color-mix\(in srgb,var\(--bb-command-alt\) 70%,transparent\) 357deg/);
  assert.match(css, /0%,14%,100%\{background:#071922/);
  assert.match(css, /2%,8%\{background:var\(--bb-command-alt\);color:#071017;border-color:var\(--bb-command-alt\);box-shadow:[^}]+var\(--bb-command-alt\)/);
});

test("seven complementary neon blips are individually aligned with the shared scanner", () => {
  assert.equal(RADAR_BLIPS.length, 7);
  assert.equal(new Set(RADAR_BLIPS.map(blip => blip.angle)).size, 7);
  for (const {angle, radius} of RADAR_BLIPS) {
    const {x, y, delay} = radarBlipPosition(angle);
    assert.ok(radius > 23 / 2 && radius < 47);
    assert.ok(Math.abs(Math.hypot(x,y) - 1) < 1e-10);
    const headAtPeak = -93 + (1.02 + delay) % 1 * 360;
    const error = ((headAtPeak - angle + 540) % 360) - 180;
    assert.ok(Math.abs(error) < 1e-6, `Blip at ${angle}°: ${error}°`);
  }
  const shared = readFileSync("components/blue-desk/radar-sweep.module.css", "utf8");
  assert.match(shared, /\.blip\{[^}]+background:var\(--bb-command-accent\)/);
  assert.match(shared, /animation-delay:calc\(var\(--radar-period,8s\) \* var\(--blip-phase\)\)/);
  assert.match(shared, /2%,7%\{opacity:1;box-shadow:[^}]+var\(--bb-command-accent\)/);
  assert.match(shared, /prefers-reduced-motion:reduce\)\{\.blip\{animation:none;opacity:\.18\}/);
});
