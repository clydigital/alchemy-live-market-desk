import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Blue Desk Markets mounts the full Hybrid tape only on the owner-authenticated hostname", () => {
  const page = read("app/blue-desk/markets/page.tsx");
  const host = read("lib/blue-desk-host.ts");
  const middleware = read("middleware.ts");
  const header = read("components/blue-desk/BlueDeskHeader.tsx");

  assert.match(page, /if \(!isBlueDeskPublicReaderHost\(host\)\)/);
  assert.match(page, /Promise\.all\(\[\s*getMarketMonitor\(\),\s*getGlobalFlowMonitor\(\),/);
  assert.match(page, /data-blue-desk-markets="hybrid-owner-tape"/);
  assert.match(page, /<MarketsMonitor monitor=\{fullMonitor\} flows=\{flows\} hybridTape \/>/);
  assert.ok(page.indexOf("if (!isBlueDeskPublicReaderHost(host))")
    < page.indexOf("const observations = publicMarketObservations"),
    "Private/owner-only branch must return before the public DTO path");
  assert.match(page, /const observations = publicMarketObservations\(monitor\?\.rows \|\| \[\], group\)/);
  assert.match(page, /<BlueDeskMarketReader observations=\{observations\} \/>/);
  assert.match(page, /<PublicGovernmentRateTrendChart series=\{officialRateTrends\}/);

  assert.match(host, /pathname === "\/markets"/);
  assert.match(host, /pathname === "\/blue-desk\/markets"/);
  assert.match(host, /isBluebellyReaderHost\(hostname\) \? "blocked" : "private"/);
  assert.match(middleware, /if \(accessScope === "public"\) return presentationResponse\(request\)/);
  assert.match(middleware, /getClaims\(\)/);
  assert.match(middleware, /app_access_allowlist/);

  assert.match(header, /\["Markets", "\/blue-desk\/markets"\]/);
  assert.match(header, /\["Markets", "\/markets"\]/);
  assert.match(header, /publicHost \? PUBLIC_NAV : PRIVATE_NAV/);
});

test("Hybrid All markets tape preserves the twelve original technical columns and source-level rows", () => {
  const monitor = read("components/live-desk/MarketsMonitor.tsx");
  for (const label of [
    "PRICE OBSERVATIONS", "All markets tape", "FEED UPDATE",
    "ASSETS", "HOT", "CONTRADICTIONS", "FLOW GAPS",
    "Search", "Type", "Screen", "Sort", "RSI limits",
    "Asset", "Chart", "Last", "Day", "Gap", "3D", "5D", "RSI", "Stoch", "Vol",
  ]) assert.ok(monitor.includes(label), "Missing screenshot field: " + label);
  assert.match(monitor, /data-hybrid-tape=\{hybridTape \? "true" : undefined\}/);
  assert.match(monitor, /type Screen = "all" \| "hot" \| "gainers" \| "losers" \| "overbought" \| "oversold"/);
  assert.match(monitor, /item === "highvol" \? "HIGH VOL" : item.toUpperCase\(\)/);
  assert.match(monitor, /sortValue\(b, sort\) - sortValue\(a, sort\)/);
  assert.match(monitor, /row\.points\.slice\(-42\)/);
  assert.match(monitor, /row\.rsi\?\.toFixed\(1\)/);
  assert.match(monitor, /row\.stochRsi\?\.toFixed\(1\)/);
  assert.match(monitor, /row\.volPercentile/);
  assert.match(monitor, /row\.attentionScore/);
  assert.match(monitor, /row\.tags\.slice\(0, 3\)/);
  assert.match(monitor, /row\.asOf/);
  assert.match(monitor, /row\.sourceUrl/);
  assert.match(monitor, /rows\.length\} assets shown/);
  assert.match(monitor, /flows\.coverageGaps\.length/);
  assert.match(monitor, /Research [a-zA-Z ]+|RESEARCH TRIGGERS/);

  assert.doesNotMatch(monitor, /Math\.random|faker|demoMarketRows|fakePrices|hardcodedMockRows/);
});

test("Hybrid dark compact reference styling is scoped to the owner tape only", () => {
  const css = read("components/live-desk/markets-monitor.module.css");
  const scope = '.workspace[data-hybrid-tape="true"]';
  assert.ok(css.includes(scope));
  assert.match(css, /#0b0d12/);
  assert.match(css, /#68d6c5/);
  assert.match(css, /#ff8f93/);
  assert.match(css, /#f5b555/);
  assert.match(css, /#223a40/);
  assert.match(css, /\.workspace\[data-hybrid-tape="true"\] \.tableWrap table/);
  assert.match(css, /\.workspace\[data-hybrid-tape="true"\] \.terminal\{order:1/);
  assert.match(css, /\.workspace\[data-hybrid-tape="true"\] \.trendChartShell\{order:2/);
  assert.match(css, /max-width:700px/);
  assert.match(css, /focus-visible/);
  assert.equal((css.match(/{/g) || []).length, (css.match(/}/g) || []).length);
  const tail = css.slice(css.indexOf("V7 R1: exact Hybrid Markets visual lineage"));
  assert.ok(tail.length > 6000);
  assert.doesNotMatch(tail, /(?:private-api-key|service_role|MARKET_MONITOR_API_KEY)/);
});

test("The public DTO still strips HOT, research triggers and market-history points", () => {
  const source = read("lib/blue-desk-public-markets.ts");
  const page = read("app/blue-desk/markets/page.tsx");
  assert.match(source, /publicMarketObservations/);
  assert.match(page, /isBlueDeskPublicReaderHost\(host\)/);
  assert.match(page, /getMarketMonitor\(\)\.catch\(\(\) => null\)/);
  // Public DTO is a shape-constrained projection, never a spread of the internal market row.
  assert.doesNotMatch(page, /<BlueDeskMarketReader observations=\{fullMonitor\.rows\}/);
  assert.doesNotMatch(page, /<MarketsMonitor monitor=\{monitor\} flows=\{flows\} hybridTape/);
  assert.match(source, /changeUnit/);
  assert.doesNotMatch(source, /\.\.\.row,/);
});

test("Owner tape stays full-width, loads Hybrid fonts and stacks its strip values", () => {
  const page = read("app/blue-desk/markets/page.tsx");
  const frame = read("app/blue-desk/blue-desk.module.css");
  const tapeStyle = read("components/live-desk/markets-monitor.module.css");
  assert.match(page, /data-blue-desk-markets="hybrid-owner-tape"/);
  assert.match(page, /Hanken\+Grotesk/);
  assert.match(page, /JetBrains\+Mono/);
  assert.match(page, /styles\.ownerMarketsFullBleed/);
  assert.match(frame, /\.ownerMarketsFullBleed\s*\{[^}]*max-width:\s*none/);
  assert.match(tapeStyle, /\.workspace\[data-hybrid-tape="true"\] \.statStrip > div\s*\{[^}]*display:\s*block/);
  assert.match(tapeStyle, /\.workspace\[data-hybrid-tape="true"\] \.statStrip strong\s*\{[^}]*display:\s*block/);
  assert.match(tapeStyle, /margin-bottom:\s*56px/);
  assert.match(tapeStyle, /margin-bottom:\s*24px/);
  assert.match(tapeStyle, /font-family:\s*"JetBrains Mono"/);
  // Public tab must remain an independent, research-signal-free client DTO.
  assert.match(page, /data-blue-desk-markets="public-observations"/);
  assert.match(page, /<BlueDeskMarketReader observations=\{observations\} \/>/);
});
