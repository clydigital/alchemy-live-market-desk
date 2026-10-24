import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { rankBlueDeskImpactFeed } from "../lib/blue-desk-impact-feed.ts";
import type { MarketMotionRecord } from "../lib/market-motion.ts";
const now=new Date("2026-10-23T10:00:00Z");
function source(partial:Partial<MarketMotionRecord>={}):MarketMotionRecord{
  const row:MarketMotionRecord={
    id:"major",motion_key:"event:major-market-shock-2026",version_number:1,previous_version_id:null,contract_version:"market-motion/v1",
    research_run_id:null,source_id:null,evidence_id:null,primary_story_id:null,primary_regime_slug:null,
    lifecycle_state:"MOTION",effective_state:"MOTION",category:"ENERGY",verification_state:"VERIFIED",
    headline:"Production halt disrupts an export terminal",what_happened:"The operator said a facility shutdown has interrupted energy shipments and provided its restart outlook.",
    market_reaction:null,why_interesting:"Traders are watching shipping premiums and diesel costs because disruption could affect energy inflation.",
    big_picture_bridge:"Potential effect on supply, rates and energy inflation.",next_test:"Confirm shipment data against insurer quotes and dated Brent observations.",
    promotion_reason:null,tickers:["B","WTI"],source_name:"Energy operator",
    source_url:"https://example.com/official/terminal-closure-2026",source_kind:"official",
    materiality:96,relevance:96,novelty:90,
    occurred_at:"2026-10-23T05:00:00Z",observed_at:"2026-10-23T05:03:00Z",expires_at:"2026-10-24T05:00:00Z",
    metadata:{},created_at:"2026-10-23T05:03:00Z",
  };
  return {...row,...partial};
}
test("a highly consequential earlier report outranks a newer low-impact report",()=>{
 const low=source({id:"routine",headline:"Company holds an industry roundtable today",source_url:"https://example.com/official/roundtable-2026",
  what_happened:"The company hosted a routine industry discussion and disclosed an agenda of its participants.",materiality:28,relevance:25,novelty:15,occurred_at:"2026-10-23T09:00:00Z",observed_at:"2026-10-23T09:01:00Z",expires_at:"2026-10-24T09:00:00Z"});
 const result=rankBlueDeskImpactFeed([low,source()],now);
 assert.equal(result[0].fact.id,"major");
 assert.equal(result[0].attention,"MAJOR");
 assert.equal(result[1].attention,"ROUTINE");
 assert.equal(result[0].isSourceOnly,true);
 assert.equal("dossierId" in result[0],false);
});
test("source admission excludes unverified, future, expired and creator opinions before ranking",()=>{
 const rows=[source({id:"lead",verification_state:"LEAD"}),source({id:"creator",source_kind:"creator"}),
 source({id:"future",occurred_at:"2026-10-24T05:00:00Z"}),source({id:"expired",expires_at:"2026-10-23T09:00:00Z"})];
 assert.equal(rankBlueDeskImpactFeed(rows,now).length,0);
});
test("research angles are visibly uncertain; no fabricated market reaction field",()=>{
 const [item]=rankBlueDeskImpactFeed([source({market_reaction:"unverified price spike claimed by an AI note"})],now);
 assert.ok(item?.researchAngle);
 assert.ok(item?.nextCheck);
 assert.equal("marketReaction" in item,false);
 assert.equal(item.assets.length,2);
});
test("Presenter Prep remains within Blue Desk through branded login and protected native owner route",()=>{
 const login=readFileSync(new URL("../app/login/page.tsx",import.meta.url),"utf8");
 const home=readFileSync(new URL("../app/blue-desk/page.tsx",import.meta.url),"utf8");
 const changed=readFileSync(new URL("../app/blue-desk/what-changed/page.tsx",import.meta.url),"utf8");
 assert.match(login,/data-bluebelly-presenter-login="within-blue-desk"/);
 assert.match(login,/<BlueDeskHeader activePath="\/blue-desk\/presenter"/);
 assert.match(login,/Continue with Google/);
 assert.match(home,/rankBlueDeskImpactFeed\(verifiedMotions, now, 8\)/);
 assert.match(home,/data-bluebelly-impact="consequence-ranked"/);
 assert.match(home,/observedMoves = publicObservations/);
 assert.match(home,/Catalyst not verified/);
 assert.match(home,/source-dated energy and rates|source-dated market/i);
 assert.ok(home.indexOf('data-bluebelly-impact="consequence-ranked"')<home.indexOf('aria-labelledby="stories-title"'));
 assert.match(changed,/rankBlueDeskImpactFeed\(raw,now,8\)/);
 const presenter=readFileSync(new URL("../app/blue-desk/presenter/page.tsx",import.meta.url),"utf8");
 assert.match(presenter,/data-presenter-motion-queue="owner-investigation-only"/);
 assert.match(presenter,/getCurrentMarketMotion\(\{limit:75\}\)/);
 assert.match(presenter,/Prioritised by materiality, relevance and novelty/);
});
