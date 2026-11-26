import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {projectPublicEquityCoverage} from "../lib/bluebelly-equity-coverage.ts";
import type {MarketMonitorRow} from "../lib/market-monitor.ts";
const now=new Date("2026-11-26T00:00:00Z");
const quote={symbol:"NVDA",frequency:"daily",currency:"USD",asOf:"2026-11-25",last:100,sourceName:"Fixture",sourceUrl:"https://example.com/nvda"} as MarketMonitorRow;
test("canonical equity feed rejects conflicting same-session values without older fallback",()=>{
 const pick=(rows:MarketMonitorRow[])=>projectPublicEquityCoverage(rows,now).rows.find(r=>r.ticker==="NVDA")!;
 assert.equal(pick([quote]).price,100);
 assert.equal(pick([quote,{...quote,last:105},{...quote,asOf:"2026-11-24",last:99}]).price,null);
 assert.equal(pick([quote,{...quote,last:100}]).price,100);
});
test("private investment view shares the canonical BB feed and never reinstates legacy quotes",()=>{
 const src=readFileSync(new URL("../app/power-stack/page.tsx",import.meta.url),"utf8");
 assert.match(src,/projectOpportunityQueue\(bbCoverage.rows,bbFundamentals\?\.rows/);
 assert.match(src,/PowerStackBBMarketSweep/);assert.match(src,/PowerStackOpportunityQueue/);
 assert.match(src,/readLongEquityHistory/);assert.match(src,/auth.getUser\(\)/);
 assert.doesNotMatch(src,/\.from\("power_stack_quote_observations"\)/);
});

test("private technical watch reads canonical retest states, gates US session events and preserves valuation-only real estate",()=>{
 const src=readFileSync(new URL("../components/blue-desk/PowerStackBBMarketSweep.tsx",import.meta.url),"utf8");
 assert.match(src,/o\.bandRespect/);assert.match(src,/BREAK_PENDING/);assert.match(src,/RESET/);assert.match(src,/INCOMPLETE_OHLC|Retest replay:/);
 assert.match(src,/recentSessionQuality\?\.status!=="VERIFIED"/);assert.match(src,/theme!=="REAL_ESTATE"/);
 assert.doesNotMatch(src,/fetch\(/);
});
