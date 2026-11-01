import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {readOwnerPowerStackQuoteScan} from "../lib/bluebelly-owner-power-stack-quote-scan.ts";

const day=new Date("2026-11-01T09:00:00Z");
const valid={ticker:"XOM",status:"CLOSED",sessionDate:"2026-10-30",close:109.4,changePct:2.16,change3dPct:4.08,change5dPct:2.20,sourceName:"Yahoo daily chart"};

test("Owner scan admits completed Friday session on Sunday and full horizon",()=>{
 const scan=readOwnerPowerStackQuoteScan({quoteScan:{contractVersion:"bluebelly-private-power-stack-scan/1",generatedAt:"2026-11-01T01:00:00Z",holdings:[valid],watchlist:[valid]}},day);
 assert.equal(scan?.holdingPriced,1);
 assert.equal(scan?.watchPriced,1);
 assert.equal(scan?.holdingRows.get("XOM")?.change3d,4.08);
 assert.equal(scan?.holdingRows.get("XOM")?.change5d,2.20);
 assert.equal(scan?.holdingRows.get("XOM")?.asOf,"2026-10-30");
});

test("Never turn missing, future, stale, unresolved or invalid rows into observations",()=>{
 const scan=readOwnerPowerStackQuoteScan({quoteScan:{contractVersion:"bluebelly-private-power-stack-scan/1",
  holdings:[valid,{...valid,ticker:"OLD",sessionDate:"2026-10-21"},
  {...valid,ticker:"FUT",sessionDate:"2026-11-04"},
  {...valid,ticker:"BAD",close:Infinity},
  {ticker:"6742UW",status:"UNRESOLVED",close:null,reason:"warrant not mapped"}],
  watchlist:[{ticker:"BTC",status:"UNRESOLVED",reason:"24-hour crypto"}]}},day);
 assert.equal(scan?.holdingTracked,5);
 assert.equal(scan?.holdingPriced,1);
 assert.equal(scan?.watchPriced,0);
 assert.equal(scan?.unresolvedHolding.length,4);
 assert.equal(scan?.unresolvedWatch.length,1);
 assert.equal(scan?.holdingRows.has("OLD"),false);
 assert.equal(scan?.holdingRows.has("FUT"),false);
 assert.equal(scan?.holdingRows.has("BAD"),false);
});

test("The full private scan stays behind owner RLS and the CP public page remains condensed",()=>{
 const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
 const owner=read("components/blue-desk/OwnerPortfolioHome.tsx");
 const full=read("components/blue-desk/OwnerPowerStackFullScan.tsx");
 const publicPage=read("app/blue-desk/markets/page.tsx");
 const css=read("app/blue-desk/markets/legibility.module.css");
 assert.ok(owner.indexOf("app_access_allowlist")<owner.indexOf("power_stack_owner_snapshots"));
 assert.match(owner,/legacy_source_retired===true/);
 assert.match(owner,/<OwnerPowerStackFullScan/);
 assert.match(full,/data-power-stack-full-private-scan/);
 assert.match(full,/data-full-watchlist/);
 assert.doesNotMatch(publicPage,/OwnerPowerStackFullScan|quoteScan|power_stack_owner_snapshots/);
 assert.match(publicPage,/legibility.compactMarkets/);
 assert.match(css,/\.compactMarkets \.marketHero/);
 const compare=read("components/blue-desk/PublicMarketScreener.tsx");
 assert.match(compare,/comparePickDisclosure/);
 assert.match(compare,/RSP vs XL sectors/);
});
