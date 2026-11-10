import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {INFLUENCE_TOPICS,reasonForTopic,projectTopicInfluence} from "../lib/bluebelly-topic-influence.ts";
import {selectManualSweeps,getManualSweeps} from "../lib/bluebelly-manual-sweeps.ts";
const now=new Date("2026-11-10T07:00:00Z");
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const finding={
 reason:"A conditional offer is not yet a restored shipping corridor",
 sourceName:"Original public dispatch",
 sourceUrl:"https://example.org/first-party-notice",
 sourcePublishedAt:"2026-11-09T10:00:00Z",
 status:"RESEARCH_LEAD" as const,
 nextCheck:"Verify actual multi-day passages",
};
const sweep={
 id:"2026-11-10-hormuz-mediation-check",topic:"hormuz",date:"2026-11-10",
 researchAt:"2026-11-10T05:30:00Z",title:"Hormuz conditional diplomacy and the physical test",
 findings:[finding],
};
test("nine Regime lenses plus Hormuz have distinct deterministic reason rules",()=>{
 assert.equal(new Set(INFLUENCE_TOPICS).size,10);
 const examples=[
  ["hormuz","Iran ceasefire talks in Doha","diplomatic breakthrough"],
  ["fed","NFP employment payroll revisions","labour-market"],
  ["bonds","US Treasury auction demand and issuance","Treasury supply"],
  ["ai","AI capex and free cash flow","convert into cash flow"],
  ["china","new AI chip export controls China","trade restrictions"],
  ["energy","diesel distillate crack spreads","refined products"],
  ["yen","BOJ and JGB yield change","JGB yields"],
  ["breadth","RSP and equal-weight breadth","market participation"],
  ["gold","official gold reserve purchases","reserve diversification"],
  ["housing","mortgage costs and housing affordability","housing demand"],
 ] as const;
 for(const [topic,text,expected] of examples){
  assert.match(reasonForTopic(topic,text).reason,new RegExp(expected,"i"),topic);
  assert.ok(reasonForTopic(topic,text).check.length>12);
 }
});
test("manual sweeps are source-vetted and distinguish research leads from canonical claims",()=>{
 const projected=selectManualSweeps({version:1,sweeps:[sweep]}, "hormuz",now);
 assert.equal(projected.length,1);
 assert.equal(projected[0].findings[0].status,"RESEARCH_LEAD");
 assert.equal(projected[0].findings[0].sourceUrl,"https://example.org/first-party-notice");
 assert.equal(projected[0].date,"2026-11-10");
 assert.equal(selectManualSweeps({version:1,sweeps:[sweep]},"ai",now).length,0);
 assert.equal(selectManualSweeps({version:2,sweeps:[sweep]},"hormuz",now).length,0);
 assert.deepEqual(getManualSweeps("hormuz",now),[]); // the real sweep is not valid before its researched-at clock
});
test("spoofed URLs, future dates and undated findings cannot publish a manual block",()=>{
 const rows=[
  {...sweep,id:"bad!",findings:[finding]},
  {...sweep,date:"2026-11-11"},
  {...sweep,researchAt:"2026-11-11T05:30:00Z"},
  {...sweep,findings:[{...finding,sourceUrl:"javascript:alert(1)"}]},
  {...sweep,findings:[{...finding,sourcePublishedAt:"2026-11-11T05:30:00Z"}]},
  {...sweep,findings:[{...finding,sourceUrl:"https://user:pass@example.org/path"}]},
  {...sweep,findings:[{...finding,status:"VERIFIED_BY_CREATOR"}]},
 ];
 for(const row of rows)assert.equal(selectManualSweeps({version:1,sweeps:[row]},"hormuz",now).length,0,
  JSON.stringify(row).slice(0,140));
});
test("manual ledger and page readers are source-linked, require a merge, and never write facts",()=>{
 const panel=read("components/blue-desk/TopicInfluencePanel.tsx");
 const source=read("lib/bluebelly-topic-influence-server.ts");
 const manual=read("lib/bluebelly-manual-sweeps.ts");
 const overview=read("app/blue-desk/regime-watch/page.tsx");
 const lens=read("app/blue-desk/regime-watch/[lensId]/page.tsx");
 assert.match(panel,/MANUAL SWEEP FINDINGS/);
 assert.match(panel,/sourceUrl/);
 assert.match(panel,/reasonRow/);
 assert.match(overview,/data-regime-source-reasons="live-source-linked-not-canonical"/);
 assert.match(overview,/getTopicInfluences/);
 assert.match(lens,/getTopicInfluence\(lensId as InfluenceTopic,now\)/);
 assert.match(source,/from\("x_wire_posts"\)/);
 assert.match(source,/from\("research_intake_items"\)/);
 assert.match(manual,/editor-committed/);
 assert.doesNotMatch(source+manual+panel,/\.insert\(|\.update\(|\.upsert\(|supabase\.rpc\(/);
});

test("dated 10 November research is committed to five topical manual lanes with original sources",()=>{
 const afterResearch=new Date("2026-11-10T17:00:00Z");
 for(const topic of ["fed","bonds","ai","hormuz","breadth"] as const){
  const records=getManualSweeps(topic,afterResearch);
  assert.equal(records.length,1,topic);
  assert.equal(records[0].date,"2026-11-10");
  assert.ok(records[0].findings.length>=2,topic);
  assert.ok(records[0].findings.every(row=>row.sourceUrl.startsWith("https://")));
 }
 assert.equal(getManualSweeps("housing",afterResearch).length,0);
});
test("AI does not inherit an unrelated long Iran roundup; a governance investigation stays governance",()=>{
 const clock=new Date("2026-11-10T16:05:00Z");
 const common={handle:"zerohedge",retrieved_at:"2026-11-10T13:34:00Z",intake_status:"discovery"};
 const unrelated={
  ...common,post_id:"2120141214594809988",
  original_url:"https://x.com/zerohedge/status/2120141214594809988",
  published_at:"2026-11-10T13:07:10Z",
  body:"Top Overnight News\nIran and Hormuz talks and blockade continue. ".repeat(2)+
   "Qatari mediation remains conditional. ".repeat(31)+"Nvidia reported new chip exports.",
 };
 const governance={
  ...common,post_id:"2120145398106824808",
  original_url:"https://x.com/zerohedge/status/2120145398106824808",
  published_at:"2026-11-10T13:23:47Z",
  body:"Premarket movers: Nvidia NVDA shares are lower amid a board investigation into CEO Jensen Huang and governance.",
 };
 const ai=projectTopicInfluence("ai",[unrelated,governance],[],clock);
 assert.equal(ai.x.length,1);
 assert.equal(ai.x[0].id,"x:2120145398106824808");
 assert.match(ai.x[0].reason,/governance/);
 const hormuz=projectTopicInfluence("hormuz",[unrelated,governance],[],clock);
 assert.equal(hormuz.x.length,1);
 assert.equal(hormuz.x[0].id,"x:2120141214594809988");
});
