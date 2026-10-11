import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  latestEditionOutageCatalysts,
  splitCurrentHybridMarketMotion,
} from "../lib/hybrid-motion-outage.ts";
import type { MarketMotionRecord } from "../lib/market-motion.ts";

const now = new Date("2026-10-11T08:30:00Z");
function motion(id:string,verificationState:MarketMotionRecord["verification_state"],extra:Partial<MarketMotionRecord>={}):MarketMotionRecord{
  return {
    id,motion_key:"feed:"+id,version_number:1,previous_version_id:null,
    contract_version:"market-motion/v1",research_run_id:null,source_id:null,evidence_id:null,
    primary_story_id:null,primary_regime_slug:null,
    lifecycle_state:"MOTION",category:"COMPANY",verification_state:verificationState,
    effective_state:"MOTION",headline:"Company update "+id,
    what_happened:"A claim was published",market_reaction:null,
    why_interesting:"Relevant to AI financing",big_picture_bridge:"Potential Regime challenge",
    next_test:"Verify against issuer SEC/IR",
    promotion_reason:null,tickers:["NVDA"],source_name:"Issuer",
    source_url:"https://www.sec.gov/example",
    source_kind:"filing",materiality:80,relevance:80,novelty:80,
    occurred_at:"2026-10-11T07:30:00Z",observed_at:"2026-10-11T07:40:00Z",
    expires_at:"2026-10-13T07:40:00Z",
    metadata:{},created_at:"2026-10-11T07:40:00Z",...extra,
  };
}
test("B2 verified and research leads are separate, no unverified promotion by market score",()=>{
  const list=[
    motion("a","LEAD",{materiality:100}),
    motion("b","VERIFIED",{materiality:60}),
    motion("c","REPORTED",{materiality:99}),
    motion("d","PARTIAL"),
    motion("e","CONTRADICTED"),
    motion("f","UNRESOLVED"),
  ];
  const out=splitCurrentHybridMarketMotion(list,now);
  assert.deepEqual(out.verified.map(x=>x.id),["b"]);
  assert.deepEqual(new Set(out.leads.map(x=>x.id)),new Set(["a","c","d","f"]));
  assert.equal(out.verified.some(x=>x.lifecycle_state==="PROMOTED"),false);
  assert.equal(out.leads.some(x=>x.verification_state==="CONTRADICTED"),false);
});
test("B2 only 0–4 source-verified current developments; exact corroboration duplicates collapse",()=>{
  const records=Array.from({length:10},(_,i)=>motion(String(i),"VERIFIED",{
    metadata:{eventIdentity:i<3?"event:issuer-capex-20261011":("event:development-"+i+"-20261011")},
    materiality:95-i,
  }));
  const out=splitCurrentHybridMarketMotion(records,now);
  assert.equal(out.verified.length,4);
  assert.equal(out.verified.filter(x=>x.metadata.eventIdentity==="event:issuer-capex-20261011").length,1);
});
test("B2 expired Motion cannot re-enter current tape, invalid source URL is not independently verified",()=>{
  const out=splitCurrentHybridMarketMotion([
    motion("expired","VERIFIED",{expires_at:"2026-10-10T01:00:00Z"}),
    motion("source","VERIFIED",{source_url:"http://untrusted.example/fact"}),
  ],now);
  assert.deepEqual(out.verified,[]);
});
test("B2 immutable edition fallback returns only future timestamped catalysts with accurate last-published vintage",()=>{
  const payload={upcoming:{
    economicCalendar:[
      {event:"US CPI",time:"2026-10-13T12:30:00Z"},
      {event:"Old jobs report",time:"2026-10-09T12:30:00Z"},
    ],
    earnings:[{company:"Microsoft",time:"2026-10-14T20:00:00Z"}],
    geopoliticalClock:[{event:"Policy deadline",time:"2026-10-12T09:00:00Z"}],
  }};
  const results=latestEditionOutageCatalysts({payload,publishedAt:"2026-10-11T03:00:00Z",now});
  assert.deepEqual(results.map(x=>x.label),["Policy deadline","US CPI","Microsoft"]);
  assert.equal(results.every(x=>x.time.endsWith("Z")),true);
  assert.equal(latestEditionOutageCatalysts({payload,publishedAt:"2026-10-07T03:00:00Z",now}).length,0);
  assert.equal(latestEditionOutageCatalysts({payload,publishedAt:"2026-10-12T03:00:00Z",now}).length,0);
  assert.equal(latestEditionOutageCatalysts({payload:{},publishedAt:"2026-10-11T03:00:00Z",now}).length,0);
});
test("B2 Dossier-null read path is BEFORE the existing early return, queries current tape, historical URL fail-closed",()=>{
  const page=readFileSync(new URL("../app/hybrid-output/page.tsx",import.meta.url),"utf8");
  const early=page.indexOf("if (!dossier) {");
  const after=page.indexOf("let researchGapStatus = null;");
  assert.ok(early>0&&after>early);
  const code=page.slice(early,after);
  assert.match(code,/getCurrentMarketMotion\(\{ limit: 60 \}\)/);
  assert.match(code,/splitCurrentHybridMarketMotion/);
  assert.match(code,/historicalRequest \? \[\] : await/);
  assert.match(code,/latestEditionOutageCatalysts/);
  assert.match(code,/Canonical Dossier|Dossier unavailable|Dossier reasoning/);
  assert.match(code,/RESEARCH LEADS · NOT VERIFIED/);
  assert.match(code,/canonical Dossier is unavailable/i);
  assert.doesNotMatch(code,/story_thesis_versions|executeDossierStoryCanonicalMutation|persistMarketMotion/);
  assert.match(page,/presenterEditionStatus === "historical"/);
  assert.match(page,/marketMotionFromEditionPayload\(motionEdition\?\.payload\)/);
  assert.match(page,/verifiedMotionJourney/);
  assert.match(page,/researchLeadJourney/);
});
