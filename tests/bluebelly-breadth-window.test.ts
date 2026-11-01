import assert from "node:assert/strict";
import test from "node:test";
import {calculateBreadthRow,REVIEWED_BREADTH_SEED,marketParticipationResearch,sourceDateFresh}
 from "../lib/bluebelly-breadth-dated.ts";
import {filterPublicMarketObservations,sortPublicMarketColumns,DEFAULT_PUBLIC_MARKET_FILTERS}
 from "../lib/blue-desk-market-filters.ts";
import type {PublicMarketObservation} from "../lib/blue-desk-public-markets.ts";

const now=new Date("2026-11-01T00:30:00Z");
test("S5FI and S5TH use point moves, not multiplying by the level",()=>{
 const fi=calculateBreadthRow("S5FI","S&P 500 > 50-day",REVIEWED_BREADTH_SEED[0],now);
 const th=calculateBreadthRow("S5TH","S&P 500 > 200-day",REVIEWED_BREADTH_SEED[1],now);
 assert.deepEqual([fi.last,fi.change,fi.change3d,fi.change5d,fi.changeUnit],[60.23,-4.77,0,2.18,"pp"]);
 assert.deepEqual([th.last,th.change,th.change3d,th.change5d,th.changeUnit],[59.44,-4.37,0.2,3.38,"pp"]);
 assert.equal(fi.asOf,"2026-10-30");
 assert.equal(fi.dataStatus,"SOURCE_DATED_SECONDARY");
});
test("source date expiry never reports an old reading as new breadth",()=>{
 assert.equal(sourceDateFresh("2026-10-30",now),true);
 assert.equal(sourceDateFresh("2026-10-30",new Date("2026-11-05T12:00:00Z")),false);
 assert.equal(sourceDateFresh("2026-11-02",now),false);
 const expired=calculateBreadthRow("S5FI","Breadth",REVIEWED_BREADTH_SEED[0],new Date("2026-11-05T12:00:00Z"));
 assert.equal(expired.last,null);assert.equal(expired.change5d,null);
 assert.equal(expired.dataStatus,"UNAVAILABLE_OR_STALE");
});
test("searching and sorting pp changes never treats them as equity percent",()=>{
 const breadth=calculateBreadthRow("S5FI","S&P 500 breadth",REVIEWED_BREADTH_SEED[0],now);
 const stock:PublicMarketObservation={...breadth,id:"stock",label:"Equal weight",symbol:"RSP",
 type:"Major Index",changeUnit:"%",change:1.1,change3d:2.4,change5d:2.7};
 const matched=filterPublicMarketObservations([breadth,stock],{
   ...DEFAULT_PUBLIC_MARKET_FILTERS,query:"S5FI",unit:"pp"});
 assert.deepEqual(matched.map(x=>x.symbol),["S5FI"]);
 assert.equal(filterPublicMarketObservations([breadth,stock],{
   ...DEFAULT_PUBLIC_MARKET_FILTERS,unit:"%",minMove:2}).length,0);
 assert.deepEqual(sortPublicMarketColumns([breadth,stock],"5D",false).map(x=>x.symbol),
 ["RSP","S5FI"]);
});
test("market participation remains research-only and requires matched source dates",()=>{
 const fi=calculateBreadthRow("S5FI","50D",REVIEWED_BREADTH_SEED[0],now);
 const th=calculateBreadthRow("S5TH","200D",REVIEWED_BREADTH_SEED[1],now);
 const note=marketParticipationResearch([fi,th]);
 assert.equal(note.status,"ready");
 assert.match(note.interpretation,/S5FI \+2.18 pp/);
 assert.match(note.interpretation,/not an admitted Regime or trade trigger/);
 assert.equal(marketParticipationResearch([fi]).status,"insufficient");
 assert.equal(marketParticipationResearch([fi,{...th,asOf:"2026-10-29"}]).status,"insufficient");
});
