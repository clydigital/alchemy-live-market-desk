import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildOwnerTodayTalk,TODAY_TALK_CONTRACT} from "../lib/bluebelly-todays-talk.ts";
import {selectVerifiedNewsBriefs} from "../lib/market-brief-news.ts";
import type {MarketMotionRecord} from "../lib/market-motion.ts";
import type {DossierPresentationSelection} from "../lib/dossier-v2/presentation-reader.ts";
import type {EditorialPriceCard} from "../lib/editorial-price-context.ts";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";

const NOW="2026-10-27T00:00:00.000Z";
const ID="11111111-1111-4111-8111-111111111111";
const EVID="22222222-2222-4222-8222-222222222222";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
function motion(id:string,importance:number):MarketMotionRecord{
 return {
  id,motion_key:id,version_number:1,previous_version_id:null,
  contract_version:"market-motion/v1",research_run_id:null,source_id:null,evidence_id:null,
  primary_story_id:null,primary_regime_slug:null,lifecycle_state:"PROMOTED",
  effective_state:"PROMOTED",category:"ENERGY",verification_state:"VERIFIED",
  headline:id==="lead"?"Oil supply disruption affects regional exports":
   "Regional supply outlook is being reviewed by ministry",
  what_happened:"The official report gives the dated physical facts about the supply situation.",
  market_reaction:"Unverified intraday price jump",why_interesting:"New",big_picture_bridge:"Unproven",
  next_test:"Check primary update",promotion_reason:null,tickers:["OIL"],
  source_name:"Example government agency",source_url:"https://agency.example.gov/releases/confirmed-report",
  source_kind:"official",materiality:importance,relevance:importance,novelty:importance,
  occurred_at:"2026-10-26T10:00:00.000Z",observed_at:"2026-10-26T11:00:00.000Z",
  expires_at:"2026-10-28T10:00:00.000Z",metadata:{},created_at:"2026-10-26T11:00:00.000Z",
 } as MarketMotionRecord;
}
function dossier(overrides:Record<string,unknown>={}):DossierPresentationSelection{
 const base={
  status:"current",selectedDossierId:ID,selectedAsOf:"2026-10-26T22:00:00.000Z",
  presentation:{
   dossierId:ID,asOf:"2026-10-26T22:00:00.000Z",health:{degraded:false},
   header:{headline:"Rates and energy shape the macro view",
    answer:"Pressure is conditional on whether supply and yields persist.",
    whatWouldChangeMind:"Source-confirmed supply recovery and lower nominal yields."},
   regimeStrip:[{key:"OIL_WAR_INFLATION",observed:true,evidenceRefs:[EVID]}],
  },
 };
 return {...base,...overrides} as unknown as DossierPresentationSelection;
}
function price():EditorialPriceCard{
 return {id:"us10y-fred",label:"US 10Y yield",symbol:"US10Y",type:"Rates",
 source:"FRED",sourceUrl:"https://fred.stlouisfed.org/series/DGS10",lastDate:"2026-10-26",
 lastClose:4.4,levelUnit:"%",status:"OBSERVED",caution:"Completed daily",
 comparisons:[{sessions:1,label:"1 session",referenceDate:"2026-10-23",reference:4.2,
  change:20,percent:null,unit:"bp",reason:null},
  {sessions:3,label:"3 sessions",referenceDate:null,reference:null,change:null,
   percent:null,unit:"bp",reason:"Fewer bars"},
  {sessions:5,label:"5 sessions",referenceDate:null,reference:null,change:null,
   percent:null,unit:"bp",reason:"Fewer bars"}]};
}
function brief(motions:MarketMotionRecord[],choice:DossierPresentationSelection|null=dossier(),
 cards:EditorialPriceCard[]=[price()],now=NOW){
 const news=selectVerifiedNewsBriefs(motions,new Date(now),18);
 return buildOwnerTodayTalk({news,motionRecords:motions,dossierSelection:choice,priceCards:cards,nowIso:now});
}
test("source-verified news ranks a fresh lead but never launders its unverified market reaction",()=>{
 const x=brief([motion("watch",45),motion("lead",98)]);
 assert.equal(x.contractVersion,TODAY_TALK_CONTRACT);
 assert.equal(x.news.length,2);
 assert.equal(x.news[0].id,"lead");
 assert.equal(x.news[0].label,"SOURCE_VERIFIED_NOT_CANONICAL");
 assert.equal(x.coverage,"SOURCE_NEWS_AND_DOSSIER");
 assert.match(x.readAloud,/original source/i);
 assert.doesNotMatch(x.readAloud,/Unverified intraday price jump/);
 assert.doesNotMatch(x.readAloud,/New\. Unproven/);
 assert.match(x.readAloud,/not a price chart confirmation/i);
});
test("Dossier only accepted when exact current healthy selected ID, clock and UUID evidence exist",()=>{
 const ok=brief([]);assert.equal(ok.coverage,"DOSSIER_ONLY");
 assert.equal(ok.dossier.dossierId,ID);assert.deepEqual(ok.dossier.evidenceRefs,[EVID]);
 for(const bad of [
  dossier({status:"fallback_previous_healthy"}),
  dossier({status:"degraded_latest"}),
  dossier({selectedDossierId:"33333333-3333-4333-8333-333333333333"}),
  dossier({selectedAsOf:"2026-10-25T22:00:00.000Z"}),
  dossier({presentation:{...dossier().presentation,asOf:"2026-10-25T22:00:00.000Z"}}),
  dossier({presentation:{...dossier().presentation,health:{degraded:true}}}),
  dossier({presentation:{...dossier().presentation,regimeStrip:[]}}),
 ]){
  const b=brief([motion("lead",99)],bad);
  assert.equal(b.coverage,"SOURCE_NEWS_ONLY");
  assert.equal(b.dossier.status,"UNAVAILABLE");
  assert.equal(b.dossier.headline,null);
  assert.equal(b.dossier.evidenceRefs.length,0);
 }
 const stale=brief([],dossier(),[], "2026-10-30T00:00:00.000Z");
 assert.equal(stale.dossier.status,"UNAVAILABLE");
});
test("ineligible source news and future/reporting timestamp cannot be implied current",()=>{
 const stale=motion("old",99);stale.occurred_at="2026-10-20T00:00:00.000Z";
 stale.observed_at="2026-10-20T01:00:00.000Z";stale.expires_at="2026-10-31T00:00:00.000Z";
 const wrong=motion("wrong",99);wrong.source_kind="creator";
 const future=motion("future",99);future.occurred_at="2026-10-28T01:00:00.000Z";
 future.observed_at="2026-10-28T01:30:00.000Z";
 const b=brief([stale,wrong,future],null,[]);
 assert.equal(b.coverage,"INSUFFICIENT");
 assert.equal(b.news.length,0);
 assert.equal(b.prices.length,0);
 assert.match(b.readAloud,/do not invent an overnight lead/i);
});
test("price cards carry source dates and bp only, while stale windows remain UNKNOWN",()=>{
 const stale={...price(),id:"brent",label:"Brent",status:"STALE" as const};
 const b=brief([],null,[stale,price()]);
 assert.equal(b.prices[0].status,"STALE");
 assert.ok(b.prices[0].windows.every(w=>w.text==="UNKNOWN"));
 assert.equal(b.prices[1].windows[0].text,"+20 bp vs 2026-10-23");
 assert.equal(b.prices[1].windows[1].text,"UNKNOWN");
 assert.match(b.readAloud,/NOT EVENT REACTION/);
});
test("owner-only route reused; no new public API, writer, cron or inference-as-fact",()=>{
 const hostname="bluebelly-desk.vercel.app";
 assert.equal(blueDeskHostAccess("/owner/presenter",hostname),"private");
 assert.equal(blueDeskHostAccess("/api/owner/todays-talk",hostname),"blocked");
 const page=read("app/owner/presenter/page.tsx");
 const projector=read("lib/bluebelly-todays-talk.ts");
 const component=read("components/blue-desk/OwnerTodayTalk.tsx");
 assert.match(page,/redirect\("\/my-reports"\)/);
 assert.doesNotMatch(page,/OwnerTodayTalk|EditorialWorkbench/);
 assert.match(component,/id="todays-talk"/);
 assert.match(component,/role="status" aria-live="polite"/);
 assert.doesNotMatch(projector,/\.(?:insert|update|upsert|delete)\(|generateContent|promptModel|createSupabaseAdminClient/);
 assert.doesNotMatch(component,/fetch\(|localStorage|generateContent/);
});
