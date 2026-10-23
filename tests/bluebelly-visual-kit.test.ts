import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const graphics = ["divergence", "transmission", "catalyst-timeline", "regime-matrix", "capex-cashflow", "yields-gold"];

test("forty first-party market glyphs resolve from an accessible SVG sprite", () => {
  const svg = read("public/market-iconography/sprite.svg");
  const ids = [...svg.matchAll(/<symbol id="bb-([\w-]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, 40);
  assert.equal(new Set(ids).size, 40);
  const component = read("components/blue-desk/MarketIcon.tsx");
  for (const key of ids) assert.match(component, new RegExp('"' + key + '"'));
  assert.match(component, /aria-hidden/);
  assert.match(component, /market-iconography\/sprite.svg/);
});

test("six gallery diagrams are illustrative, dated-source neutral and do not embed private research", () => {
  for (const key of graphics) {
    const svg = read("public/market-iconography/graphics/" + key + ".svg");
    assert.match(svg, /viewBox="0 0 960 360"/);
    assert.match(svg, /ILLUSTRATIVE SCHEMATIC/);
    assert.match(svg, /NOT MARKET DATA/);
    assert.doesNotMatch(svg, /(?:research_run_id|motionId|dossierId|story_thesis_versions|service_role|apikey|secret)/i);
  }
});

test("public Bluebelly navigation keeps its owner-only link boundary", () => {
  const header = read("components/blue-desk/BlueDeskHeader.tsx");
  const host = read("lib/blue-desk-host.ts");
  const page = read("app/blue-desk/page.tsx");
  const markets = read("app/blue-desk/markets/page.tsx");
  const calendar = read("app/blue-desk/calendar/page.tsx");
  assert.match(header, /publicHost \? PUBLIC_NAV : PRIVATE_NAV/);
  assert.match(header, /NAV_ICONS/);
  assert.match(host, /isBluebellyReaderHost\(hostname\) \? "blocked"/);
  assert.match(page, /MarketIcon name="divergence"/);
  assert.match(markets, /GROUP_ICONS/);
  assert.match(calendar, /MarketIcon name="calendar"/);
});

test("copy and download controls remain private presenter-only and visibly labelled", () => {
  const shelf = read("components/blue-desk/MarketGraphicsShelf.tsx");
  const prep = read("app/hybrid-output/prepare/page.tsx");
  const homepage = read("app/blue-desk/page.tsx");
  assert.match(shelf, /navigator\.clipboard\.writeText/);
  assert.match(shelf, /canvas\.toBlob/);
  assert.match(shelf, /role="status"/);
  assert.match(shelf, /disabled=\{Boolean\(busy\)\}/);
  assert.match(prep, /projection\.status !== "READY" \|\| !projection\.pinned/);
  assert.match(prep, /<MarketGraphicsShelf\s*\/>/);
  assert.doesNotMatch(homepage, /MarketGraphicsShelf/);
});
