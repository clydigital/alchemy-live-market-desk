import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomRadarBlips, radarBlipPosition, radarSweepFrame, radarBlipOpacity, MAX_RADAR_BLIPS } from "../lib/bluebelly-radar-blips.ts";

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
  const entries = [["A", "/markets", "MARKETS"], ["B", "/calendar", "CATALYSTS"], ["C", "/newsroom", "NEWSROOM"]] as const;
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

test("horizontal scanner overlays the radar with faded edges and cannot detect blips", () => {
  const shared = readFileSync("components/blue-desk/radar-sweep.module.css", "utf8");
  const scanner = readFileSync("components/blue-desk/RadarSweep.tsx", "utf8");
  assert.match(shared, /\.scanline\{[^}]+z-index:3;border-radius:50%;overflow:hidden;pointer-events:none/);
  const line = shared.match(/\.scanline::before\{([^}]+)\}/)![1];
  assert.match(line, /height:1px/);
  assert.match(line, /background:linear-gradient\(90deg,transparent,var\(--bb-command-alt\),transparent\);opacity:\.45/);
  assert.match(line, /animation:bb-radar-scanline 12s linear infinite/);
  assert.doesNotMatch(line, /box-shadow|filter/);
  assert.match(shared, /@keyframes bb-radar-scanline\{\s*0%\{top:-1px;opacity:0\}\s*10%,80%\{opacity:\.45\}\s*100%\{top:100%;opacity:0\}/);
  assert.match(shared, /prefers-reduced-motion:reduce\)\{\.scanline\{display:none\}/);
  assert.match(scanner, /<span className=\{ui\.scanline\} aria-hidden="true"\/>/);
  assert.equal((scanner.match(/getAnimations\(/g) ?? []).length, 1);
  assert.match(scanner, /sweep!\.getAnimations\(\)\[0\]/);
});

test("three to five randomly positioned neon blips align with the shared scanner", () => {
  const counts = new Set<number>();
  const layouts = new Set<string>();
  for (let seed = 1; seed <= 100; seed++) {
    let state = seed * 1009;
    const blips = randomRadarBlips(() => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32));
    counts.add(blips.length);
    layouts.add(JSON.stringify(blips));
    assert.ok(blips.length >= 3 && blips.length <= MAX_RADAR_BLIPS);
    for (const [i, {angle, radius}] of blips.entries()) {
      const {x, y, contactPhase} = radarBlipPosition(angle);
      assert.ok(radius >= 30 && radius <= 45);
      assert.ok(Math.abs(Math.hypot(x,y) - 1) < 1e-10);
      assert.ok(contactPhase >= 0 && contactPhase < 1);
      const error = ((-93 + contactPhase * 360 - angle + 540) % 360) - 180;
      assert.ok(Math.abs(error) < 1e-6);
      for (const other of blips.slice(0, i)) assert.ok(Math.abs(((angle - other.angle + 540) % 360) - 180) >= 18);
    }
  }
  assert.deepEqual([...counts].sort(), [3, 4, 5]);
  assert.equal(layouts.size, 100);
});

test("blip layouts relocate only every three turns and never glow ahead of contact", () => {
  for (let cycle = 0; cycle < 10; cycle++) {
    for (const phase of [0, .1, .5, .99]) {
      const frame = radarSweepFrame((cycle + phase) * 8000, 8000);
      assert.equal(frame.group, Math.floor(cycle / 3));
      assert.equal(frame.cycle, cycle);
      assert.ok(Math.abs(frame.phase - phase) < 1e-10);
    }
  }
  assert.equal(radarBlipOpacity(0, .4), 0);
  assert.equal(radarBlipOpacity(.399999, .4), 0);
  assert.equal(radarBlipOpacity(.4, .4), 1);
  assert.equal(radarBlipOpacity(.44, .4), 1);
  assert.ok(radarBlipOpacity(.49, .4) > 0 && radarBlipOpacity(.49, .4) < 1);
  assert.equal(radarBlipOpacity(.56, .4), 0);
  assert.equal(radarBlipOpacity(0, .98), 0);
  const shared = readFileSync("components/blue-desk/radar-sweep.module.css", "utf8");
  assert.match(shared, /\.blip\{[^}]+background:var\(--bb-command-accent\);opacity:0/);
  assert.match(shared, /\.blip\[hidden\]\{display:none!important\}/);
  assert.match(shared, /prefers-reduced-motion:reduce\)\{\.blip\{display:none!important\}/);
  const scanner = readFileSync("components/blue-desk/RadarSweep.tsx", "utf8");
  assert.match(scanner, /className=\{ui\.blip\} hidden/);
  assert.match(scanner, /getAnimations\(\)\[0\]/);
  assert.match(scanner, /animation\?\.currentTime/);
  assert.match(scanner, /next\.cycle === layoutStartCycle && position\.contactPhase < layoutStartPhase/);
});
