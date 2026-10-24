import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {buildReactionLedger,ledgerAsResearchPacket,REACTION_ASSET_IDS} from "../lib/editorial-reaction-ledger.ts";
import {investigationToDraftPacket,mergeInvestigationIntoDraftPacket}
 from "../lib/editorial-investigation.ts";
import type {EditorialPriceCard,EditorialWindow} from "../lib/editorial-price-context.ts";

const now="2026-10-25T01:00:00.000Z";
const src="https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?f=D&n=PET&s=RBRTE";
function card(id:string,overrides:Partial<EditorialPriceCard>={}):EditorialPriceCard{
 const windows=([1,3,5] as const).map((sessions,i)=>({
  sessions,label:sessions+" sessions",
  referenceDate:["2026-10-22","2026-10-20","2026-10-16"][i],
  reference:[100,96,94][i],change:[2,6,8][i],percent:[2,6.25,8.51][i],
  unit:"%" as const,reason:null,
 }));
 return {
  id,label:id+" original daily history",symbol:id.toUpperCase(),
  type:"Energy",source:"EIA",sourceUrl:src,lastDate:"2026-10-23",
  lastClose:102,levelUnit:"source units",status:"OBSERVED",
  caution:"Daily source observations, no event ticks.",comparisons:windows,...overrides,
 };
}
test("R2 aligns cross-asset windows only on identical start and end observation dates",()=>{
 const brent=card("brent");
 const wti=card("wti",{source:"NYMEX labelled monitor",sourceUrl:"https://www.cmegroup.com/markets/energy/crude-oil/light-sweet-crude.html"});
 const rates=card("us10y-fred",{
  type:"Rates",source:"Federal Reserve",
  sourceUrl:"https://fred.stlouisfed.org/series/DGS10",
  lastClose:5.1,levelUnit:"%",comparisons:brent.comparisons.map(w=>({
   ...w,reference:5,change:10,unit:"bp",percent:null,
  })),
 });
 const l=buildReactionLedger([brent,wti,rates],"brent",now,"2026-10-22T08:30:00-04:00");
 assert.equal(l.status,"DAILY_SOURCE_COMPARISON_NOT_EVENT_REACTION");
 assert.equal(l.anchorId,"brent");
 assert.equal(l.eventAt,"2026-10-22T12:30:00.000Z");
 assert.deepEqual(l.windows.map(x=>x.status),[
  "MATCHED_DAILY_OBSERVATION","MATCHED_DAILY_OBSERVATION","MATCHED_DAILY_OBSERVATION",
 ]);
 assert.deepEqual(l.windows[0].observations.map(o=>o.id),["brent","wti","us10y-fred"]);
 assert.deepEqual(l.windows[0].observations.map(o=>o.unit),["%","%","bp"]);
 assert.equal(l.windows[0].from,"2026-10-22");
 assert.equal(l.windows[0].to,"2026-10-23");
 assert.equal(l.eventWindows.length,3);
 assert.ok(l.eventWindows.every(x=>x.status==="UNKNOWN"));
 assert.match(ledgerAsResearchPacket(l),/5m post-event: UNKNOWN/);
 assert.match(ledgerAsResearchPacket(l),/Federal Reserve/);
 assert.match(ledgerAsResearchPacket(l),/NOT EVENT REACTION/);
});
test("R2 refuses staggered close dates and stale observations",()=>{
 const brent=card("brent");
 const wti=card("wti",{lastDate:"2026-10-22"});
 const stale=card("spx",{status:"STALE"});
 const l=buildReactionLedger([brent,wti,stale],"brent",now);
 assert.equal(l.windows[0].status,"UNKNOWN");
 assert.deepEqual(l.windows[0].observations,[]);
 assert.match(l.windows[0].reason,/Fewer than two eligible assets/);
 assert.equal(l.assets.length,2);
 assert.equal(l.eventAt,null);
 assert.match(l.warnings.at(-1)||"",/No explicit event clock/);
});
test("R2 does not invent a reaction when provider, bars or exact dates are missing",()=>{
 const missing=card("brent",{sourceUrl:null,status:"OBSERVED"});
 const monthly=card("wti",{status:"UNKNOWN"});
 const l=buildReactionLedger([missing,monthly],"brent",now,"2026-10-26T09:00:00Z");
 assert.equal(l.anchorId,null);
 assert.ok(l.windows.every(x=>x.status==="UNKNOWN"));
 assert.ok(l.eventWindows.every(x=>x.status==="UNKNOWN"));
 assert.equal(l.eventAt,null);
 assert.match(l.warnings.at(-1)||"",/invalid, future-dated/);
});
test("R2 verifies original daily observations, not user-submitted provider prices or unknown assets",()=>{
 const s=card("spx");
 const byUser=card("private-watched-asset");
 const l=buildReactionLedger([byUser,s],"private-watched-asset",now);
 assert.equal(l.requestedAssetId,null);
 assert.ok(!l.assets.some(x=>x.id==="private-watched-asset"));
 assert.ok(l.eventWindows.every(x=>x.status==="UNKNOWN"));
 assert.ok(!REACTION_ASSET_IDS.includes("private-watched-asset" as never));
});
test("R2 source window packet survives explicit research handoff to drafting, still unverified",()=>{
 const brent=card("brent"),wti=card("wti");
 const l=buildReactionLedger([brent,wti],"brent",now);
 const model={
  contractVersion:"editorial-investigation/1" as const,
  mode:"OB" as const,status:"RESEARCH_LEADS_UNVERIFIED" as const,
  narrative:"Measured daily bars do not prove causality. ".repeat(8),
  sources:[],claimSupports:[],searchQueries:[],groundedSupportCount:0,
  limitations:["No event ticks"],canPublish:false as const,reactionLedger:l,
 };
 const packet=investigationToDraftPacket(model);
 assert.match(packet,/DAILY OBSERVATIONS/);
 assert.match(packet,/1 session\(s\)/);
 assert.match(packet,/5m post-event: UNKNOWN/);
 assert.match(packet,/NONCANONICAL AND UNVERIFIED/);
 const combined=mergeInvestigationIntoDraftPacket("No verified reaction ".repeat(1500),model);
 assert.ok(combined.length<=24_000);
 assert.match(combined,/5m post-event: UNKNOWN/);
 assert.match(combined,/NONCANONICAL AND UNVERIFIED/);
});
test("R2 rebuilds prices from server, uses owner allowlist and avoids writes",()=>{
 const r=readFileSync(new URL("../app/api/owner/editorial-investigate/route.ts",import.meta.url),"utf8");
 assert.match(r,/createSupabaseServerClient/);
 assert.match(r,/app_access_allowlist/);
 assert.match(r,/getMarketMonitor\(\)/);
 assert.match(r,/projectEditorialPriceCards\(monitor\?\.rows\|\|\[],now\)/);
 assert.match(r,/buildReactionLedger\(cards,requestedAssetId,now,eventAt\)/);
 assert.match(r,/ledgerAsResearchPacket\(reactionLedger\)/);
 assert.match(r,/\{ \.\.\.result,reactionLedger,model \}/);
 assert.doesNotMatch(r,/\.from\("story_thesis_versions"\)|createSupabaseAdminClient|persistSensorMemory/);
 const p=readFileSync(new URL("../components/blue-desk/InvestigationWorkbench.tsx",import.meta.url),"utf8");
 assert.match(p,/selectedAssetId,eventAt/);
 assert.match(p,/Observed price context · matched daily sessions/);
 assert.match(p,/5m \/ 30m \/ 4h event-window reactions/);
 assert.match(p,/no timestamped intraday provider bars were admitted/);
});
