import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildBlueDeskDailyMarketMap, BLUE_DESK_MARKET_MAP_CONTRACT } from "../lib/blue-desk-daily-market-map.ts";
import type { PublicMarketObservation } from "../lib/blue-desk-public-markets.ts";

const now = new Date("2026-10-23T13:00:00Z");
function observation(id: string, opts: Partial<PublicMarketObservation> = {}): PublicMarketObservation {
  return {
    id, label: id, symbol:id.toUpperCase(),type:"Major Index",last:100,change:1.5,
    changeUnit:"%",asOf:"2026-10-22T20:00:00Z",frequency:"daily",
    sourceName:"Original official provider",
    sourceUrl:"https://example.org/reports/dated-record",
    ...opts,
  };
}
const page = readFileSync(new URL("../app/blue-desk/page.tsx",import.meta.url),"utf8");

test("eight independently dated market lenses are built even without a Dossier",()=>{
  const map=buildBlueDeskDailyMarketMap([],now);
  assert.equal(map.contractVersion,BLUE_DESK_MARKET_MAP_CONTRACT);
  assert.deepEqual(map.lenses.map(l=>l.key),["rates","equities","breadth","energy","fx","credit","metals","ai"]);
  assert.equal(map.observedCount,0);
  assert.ok(map.lenses.every(l=>l.state==="UNAVAILABLE"&&l.observations.length===0));
});

test("source-dated observations stay factual; absent data is never filled by nearby symbols",()=>{
  const map=buildBlueDeskDailyMarketMap([
    observation("us10y-fred",{type:"Rates",changeUnit:"bp",change:-2.0}),
    observation("spx"),observation("rsp"),
    observation("brent",{type:"Energy",last:113,sourceUrl:"https://example.org/original/oil"}),
    observation("hy-oas",{type:"Credit / Risk",asOf:"2026-09-25T00:00:00Z"}),
    observation("smh",{type:"AI / Semis",asOf:"2026-10-24T20:00:00Z"}),
    observation("dxy",{type:"FX",sourceUrl:null}),
    observation("gold-proxy",{type:"Metal",last:null}),
  ],now);
  assert.equal(map.observedCount,5);
  assert.equal(map.lenses.find(l=>l.key==="rates")?.observations[0]?.change,-2);
  assert.equal(map.lenses.find(l=>l.key==="breadth")?.observations.length,2);
  assert.equal(map.lenses.find(l=>l.key==="energy")?.observations[0]?.last,113);
  assert.equal(map.lenses.find(l=>l.key==="credit")?.state,"OLDER_SOURCE");
  assert.equal(map.lenses.find(l=>l.key==="ai")?.state,"UNAVAILABLE");
  assert.equal(map.lenses.find(l=>l.key==="fx")?.state,"UNAVAILABLE");
  assert.equal(map.lenses.find(l=>l.key==="metals")?.state,"UNAVAILABLE");
  assert.equal(map.olderCount,1);
  assert.ok(!JSON.stringify(map).includes("dossierId"));
  assert.ok(!JSON.stringify(map).includes("canonicalEvidenceId"));
});

test("blank original source, future dates, missing values, and invalid clocks fail closed",()=>{
  const rows=[
    observation("wti",{type:"Energy",sourceName:""}),
    observation("gold-proxy",{type:"Metal",asOf:"not a date"}),
    observation("us2y",{type:"Rates",last:NaN}),
    observation("spx",{sourceUrl:""}),
    observation("rsp",{sourceUrl:"javascript:alert(1)"}),
  ];
  const map=buildBlueDeskDailyMarketMap(rows,now);
  assert.equal(map.observedCount,0);
  assert.equal(buildBlueDeskDailyMarketMap([observation("spx")],new Date("invalid")).observedCount,0);
});

test("homepage renders source-only daily angles before the single Dossier-dependent hero",()=>{
  assert.match(page,/buildBlueDeskDailyMarketMap/);
  assert.match(page,/aria-labelledby="daily-map-title"/);
  assert.ok(page.indexOf('aria-labelledby="daily-map-title"') < page.indexOf('aria-label="Latest canonical Market Brief"'));
  assert.match(page,/lens\.observations\.map/);
  assert.match(page,/row\.sourceUrl/);
  assert.match(page,/OLDER_SOURCE/);
  assert.match(page,/No verified observation for this lens/);
  assert.match(page,/getCurrentVerifiedMarketMotion/);
  assert.doesNotMatch(page,/\.from\("intelligence_evidence"\)|\.upsert\(|system2Adjudicate\(|createSupabaseAdminClient\(/);
});
