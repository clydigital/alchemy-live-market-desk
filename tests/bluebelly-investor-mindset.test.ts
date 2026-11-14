import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildInvestorMindsetSnapshot} from "../lib/bluebelly-investor-mindset.ts";
import type {PublicMarketObservation} from "../lib/blue-desk-public-markets.ts";
import type {MarketDivergenceRead} from "../lib/bluebelly-market-divergence-watch.ts";
import type {MarketCompassSummary} from "../lib/bluebelly-market-compass.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";

const now=new Date("2026-11-14T04:00:00Z");
function market(id:string,change:number,asOf="2026-11-13"):PublicMarketObservation{
 return {
  id,label:id==="us2y"?"US 2Y":id==="brent"?"Brent crude":id,
  symbol:id==="us2y"?"DGS2":"BZ=F",type:id==="us2y"?"Rates":"Energy",
  last:id==="us2y"?4.3:80,change,change3d:null,change5d:null,
  changeUnit:id==="us2y"?"bp":"%",frequency:"daily",asOf,
  sourceName:"Dated primary price series",sourceUrl:"https://fred.stlouisfed.org/series/DGS2",
  dataStatus:"SOURCE_DATED_SECONDARY"
 };
}
function pair(id:"semis-vs-nasdaq"|"equal-vs-cap",gap:number,date="2026-11-13"):MarketDivergenceRead{
 const isChips=id==="semis-vs-nasdaq";
 return {id,title:id,left:isChips?"SMH":"RSP",right:isChips?"QQQ":"SPY",
  question:"Participation?",nextTest:"Next close",status:"RELATIVE_MOVE",
  leftChange:gap+0.5,rightChange:0.5,gapPp:gap,
  sourceSession:date,leftSourceUrl:"https://www.nasdaq.com/market-activity/etf/smh/historical",
  rightSourceUrl:"https://www.nasdaq.com/market-activity/etf/qqq/historical",reason:null};
}
function compass():MarketCompassSummary{
 return {state:"MIXED",title:"Mixed",explanation:"Observed ETF tape",
  contradiction:"Unknown cause",nextTest:"Credit",sourceSession:"2026-11-13",
  evidenceCount:4,note:"No causal inference"};
}
function news():NewsBriefV1{
 return {contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",id:"event",
  headline:"Official policy data release",summary:"Source dated report",sourceName:"Official release",
  sourceUrl:"https://www.bls.gov/news.release/cpi.toc.htm",sourceKind:"official",
  occurredAt:"2026-11-13T15:00:00Z",observedAt:"2026-11-13T16:00:00Z",
  verification:"SOURCE_VERIFIED"};
}
test("homepage board shows five differentiated evidence-backed market questions",()=>{
 const snapshot=buildInvestorMindsetSnapshot(
  [market("us2y",14),market("brent",-2)],[pair("semis-vs-nasdaq",1.4),pair("equal-vs-cap",-0.5)],
  compass(),[news()],now);
 assert.deepEqual(snapshot.rows.map(r=>r.id),["rates","chips","breadth","oil","catalyst"]);
 assert.equal(snapshot.rows[0].signal,"YIELDS RISING");
 assert.equal(snapshot.rows[0].tone,"negative");
 assert.equal(snapshot.rows[1].signal,"CHIPS LEAD");
 assert.equal(snapshot.rows[2].tone,"negative");
 assert.equal(snapshot.rows[3].signal,"CRUDE FALLING");
 assert.equal(snapshot.rows[4].signal,"SOURCE-VERIFIED EVENT");
 assert.equal(snapshot.tape,"MIXED");
 assert.ok(snapshot.rows.every(r=>r.sources.length>0));
 assert.ok(snapshot.rows.every(r=>r.question.includes("?")));
});
test("stale market data and news do not become confident investor calls",()=>{
 const stale="2026-10-27";
 const snapshot=buildInvestorMindsetSnapshot([market("us2y",20,stale),market("brent",2,stale)],
 [pair("semis-vs-nasdaq",2,stale),pair("equal-vs-cap",-2,stale)],compass(),
 [{...news(),occurredAt:"2026-11-02T12:00:00Z"}],now);
 assert.ok(snapshot.rows.every(r=>r.tone==="unmeasured"));
 assert.ok(snapshot.rows.every(r=>r.asOf===null));
 assert.equal(snapshot.rows[4].signal,"UNMEASURED");
});
test("unfinished US market session must not be read as a completed comparison",()=>{
 const beforeClose=new Date("2026-11-13T19:00:00Z");
 const snapshot=buildInvestorMindsetSnapshot([],
 [pair("semis-vs-nasdaq",2),pair("equal-vs-cap",2)],compass(),[],beforeClose);
 assert.equal(snapshot.rows[1].tone,"unmeasured");
 assert.equal(snapshot.rows[2].tone,"unmeasured");
 assert.equal(snapshot.tape,"UNMEASURED");
});
test("homepage reader is source-only and labels its reasoning honestly",()=>{
 const page=readFileSync(new URL("../app/blue-desk/page.tsx",import.meta.url),"utf8");
 const component=readFileSync(new URL("../components/blue-desk/InvestorMindsetBoard.tsx",import.meta.url),"utf8");
 const css=readFileSync(new URL("../components/blue-desk/InvestorMindsetBoard.module.css",import.meta.url),"utf8");
 assert.match(page,/buildInvestorMindsetSnapshot\(marketRows,marketComparisons,marketCompass,verifiedNews,now\)/);
 assert.match(page,/<InvestorMindsetBoard snapshot=\{investorMindset\} assessment=\{investorAssessment\} host=\{host\}/);
 assert.match(page,/projectInvestorAssessment\(dossierSelection,now\)/);
 assert.match(page,/getDossierV2PresentationSelection\(\)/);
 assert.match(component,/Signals are dated observations, not proof of institutional flows/);
 assert.match(component,/data-home-investor-mindset="source-dated-v1"/);
 assert.match(css,/@media\(max-width:680px\)/);
 assert.doesNotMatch(component,/createSupabaseAdminClient|service_role|\.upsert\(|\.insert\(|createTask\(/);
});
