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
 assert.deepEqual(getManualSweeps("hormuz",now),[]); // empty until a real user-requested sweep is committed
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
