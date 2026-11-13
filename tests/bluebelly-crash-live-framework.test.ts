import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildCrashDecisionLayer,recentCrashResearch} from "../lib/bluebelly-crash-decision-live.ts";
import type {CrashSignal,CrashWatchView} from "../lib/bluebelly-crash-opportunity.ts";
import type {MarketCompassSummary,CompassState} from "../lib/bluebelly-market-compass.ts";
import type {PublicMacroPulseBrief} from "../lib/blue-desk-macropulse-brief.ts";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const now=new Date("2026-11-14T07:00:00Z");
function view(breadth:CrashSignal,credit:CrashSignal):CrashWatchView{
 return {
  position:"CONTESTED",confidence:"LOW",lastReviewed:now.toISOString(),confirmedSignals:0,
  measurementCoverage:Number(breadth!=="UNKNOWN")+Number(credit!=="UNKNOWN"),
  sourceStatus:"PARTIAL",caveat:"Source dated",
  readings:[{id:"hy-oas",label:"HY OAS",symbol:"HY",value:3.2,dayChange:null,
   fiveSessionChange:credit==="BULL"?-25:credit==="BEAR"?35:null,
   asOf:credit==="UNKNOWN"?null:"2026-11-13",status:credit==="UNKNOWN"?"MISSING":"DATED",
   unit:"spread-percent",sourceName:"FRED",sourceUrl:"https://fred.stlouisfed.org/series/BAMLH0A0HYM2",
   note:"Credit spread, not ETF price"}],
  pillars:[
   {id:"breadth",name:"Breadth",signal:breadth,basis:"Same-session RSP versus SPX 5D gap",
    nextTest:"Confirm wider A/D",watchId:"breadth",observedAt:breadth==="UNKNOWN"?null:"2026-11-13"},
   {id:"credit",name:"Credit",signal:credit,basis:"High-yield spread moved in basis points",
    nextTest:"Primary issuance",watchId:"bonds",observedAt:credit==="UNKNOWN"?null:"2026-11-13"}
  ]
 };
}
function compass(state:CompassState):MarketCompassSummary{
 return {state,title:state==="RISK_ON"?"Risk appetite improving":"Defensive equity session",
 explanation:"Matched ETFs",contradiction:"Test",nextTest:"Source",sourceSession:state==="UNMEASURED"?null:"2026-11-13",
 evidenceCount:state==="UNMEASURED"?0:4,note:"Ordinal 1D tape"};
}
test("durable recovery is only aligned when 1D tape, 5D breadth, HY funding agree",()=>{
 const v=buildCrashDecisionLayer(view("BULL","BULL"),compass("RISK_ON"));
 assert.equal(v.scenarios.find(s=>s.id==="durable")?.state,"ALIGNED");
 assert.equal(v.scenarios.find(s=>s.id==="contagion")?.state,"CONTRADICTED");
 assert.equal(v.scenarios.find(s=>s.id==="bounce")?.state,"PARTIAL");
 assert.match(v.scenarios[0].nextTest,/cash-flow guidance/);
 assert.equal(v.coverage.startsWith("3\/3"),false); // actual UI coverage text has a slash, not a decimal rating
 assert.match(v.coverage,/3\/3 comparable decision inputs/);
});
test("credit-led risk only aligns with broad selloff and failing breadth",()=>{
 const v=buildCrashDecisionLayer(view("BEAR","BEAR"),compass("RISK_OFF"));
 assert.equal(v.scenarios.find(s=>s.id==="contagion")?.state,"ALIGNED");
 assert.match(v.strongest,/forced-selling mechanism remains unverified/);
 const oneCounter=buildCrashDecisionLayer(view("BULL","BULL"),compass("RISK_OFF"));
 assert.equal(oneCounter.scenarios.find(s=>s.id==="contagion")?.state,"CONTRADICTED");
});
test("one day bounce against weak breadth and credit is a possible trap, not a bottom",()=>{
 const v=buildCrashDecisionLayer(view("BEAR","BEAR"),compass("RISK_ON"));
 assert.equal(v.scenarios.find(s=>s.id==="bounce")?.state,"ALIGNED");
 assert.equal(v.scenarios.find(s=>s.id==="durable")?.state,"CONTRADICTED");
 assert.match(v.scenarios.find(s=>s.id==="bounce")!.evidence,/No live short-covering/);
});
test("missing sources never become a bull or bear verdict or false recency",()=>{
 const v=buildCrashDecisionLayer(view("UNKNOWN","UNKNOWN"),compass("UNMEASURED"));
 assert.ok(v.scenarios.every(s=>s.state==="UNMEASURED"));
 assert.equal(v.marketSession,null);
 assert.equal(v.creditSession,null);
 assert.equal(v.checkpoints.filter(x=>x.state==="OBSERVED").length,0);
 assert.match(v.strongest,/Insufficient agreement/);
});
function pub(id:string,overrides:Partial<PublicMacroPulseBrief>={}):PublicMacroPulseBrief{
 return {
 id,source_page_id:"aaa",source_pulse_id:id,source_page_url:"https://app.notion.com/p/x",
 source_published_at:"2026-11-13T03:00:00Z",source_retrieved_at:"2026-11-13T04:00:00Z",
 headline:"Treasury yield and AI funding stress",standfirst:"Official source and source-dated market analysis",
 what_changed:"Spread changes",why_it_matters:"AI capex and funding",countercase:"Funding might stabilise",
 watch_next:"Recheck original issuer",primary_region:"US",
 source_links:[{kind:"PRIMARY_RELEASE",url:"https://www.federalreserve.gov",label:"Fed original"}],
 verification_label:"RESEARCH_DERIVED_UNADJUDICATED",published_at:"2026-11-13T05:00:00Z",
 ...overrides};
}
test("public MacroPulse research admitted only when recent, attributed and not social-only",()=>{
 const a=recentCrashResearch([
  pub("ok"),
  pub("ok"),
  pub("old",{source_published_at:"2026-10-01T00:00:00Z"}),
  pub("future",{source_published_at:"2026-11-16T00:00:00Z"}),
  pub("only-social",{source_links:[{kind:"SOCIAL_LEAD",label:"Video",url:"https://youtube.com/watch?v=123"}]}),
  pub("not-topic",{headline:"Home baking tutorial",standfirst:"Bread and cakes",why_it_matters:"Vanilla pastries"}),
  pub("unsafe",{source_links:[{kind:"PRIMARY_RELEASE",label:"Fake",url:"javascript:alert(1)"}]}),
 ],now);
 assert.deepEqual(a.map(x=>x.id),["ok"]);
});
test("public page uses only existing scheduled source readers; historic episodes remain explicit archives",()=>{
 const page=read("app/blue-desk/crash-opportunity/page.tsx");
 const css=read("app/blue-desk/crash-opportunity/crash-opportunity.module.css");
 assert.match(page,/getMarketMonitor\(/);
 assert.match(page,/getPublishedMacroPulseBriefs\(8\)/);
 assert.match(page,/buildMarketCompassSummary\(matchedTape,now\)/);
 assert.match(page,/buildCrashDecisionLayer\(watch,compass\)/);
 assert.match(page,/recentCrashResearch\(publishedPulse,now,3\)/);
 assert.match(page,/data-crash-live="existing-source-feeds-v1"/);
 assert.match(page,/data-crash-automated-research="public-macropulse"/);
 assert.match(page,/data-crash-research-archive="historical-editions"/);
 assert.match(page,/data-regime-challenge="2026-11-11-source-dated"/);
 assert.match(page,/CRASH_HISTORY/);
 assert.match(css,/\.scenario\[data-scenario-state="ALIGNED"\]\[data-crash-scenario="durable"\]/);
 assert.match(css,/\.scenario\[data-scenario-state="ALIGNED"\]\[data-crash-scenario="contagion"\]/);
 assert.doesNotMatch(page,/createSupabaseAdminClient|service_role|\.upsert\(|\.insert\(|createTask\(|schedule\(/);
});
