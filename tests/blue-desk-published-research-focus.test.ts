import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import type {PublicMacroPulseBrief} from "../lib/blue-desk-macropulse-brief.ts";
import {projectPublishedResearchFocus,researchForPublicLens} from "../lib/blue-desk-published-research-focus.ts";

const one:PublicMacroPulseBrief={
 id:"404519b6-7a94-8118-b347-d363f9b215a9",source_page_id:"404519b6-7a94-8118-b347-d363f9b215a9",
 source_pulse_id:"2026-11-01-0800-iran-hormuz-conditional-opening",
 source_page_url:"https://www.notion.so/404519b67a948118b347d363f9b215a9",
 source_published_at:"2026-11-01T08:00:00Z",source_retrieved_at:"2026-11-01T08:10:00Z",
 headline:"Iranian negotiators put forward a conditional Hormuz reopening",
 standfirst:"Iran's proposed sequence remains conditional pending documented US acceptance.",
 what_changed:"A Qatar-mediated proposal calls for reopening the Strait of Hormuz.",
 why_it_matters:"Shipping risk may affect crude and diesel; no causal price reaction measured.",
 countercase:"A proposal is not an accepted agreement or proof of safe tanker passage.",
 watch_next:"Confirm a signed sequence and real multiday ship crossings.",
 primary_region:"Other",source_links:[{
  url:"https://www.reuters.com/world/middle-east/iran-talks-2026-11-01/",
  kind:"REPORTING",label:"Reuters diplomatic coverage",
 }],verification_label:"RESEARCH_DERIVED_UNADJUDICATED",
 published_at:"2026-11-01T12:00:00Z",
};
const now=new Date("2026-11-02T05:00:00Z");
test("a newly approved weekend dispatch is discoverable Monday and remains research-derived",()=>{
 const items=projectPublishedResearchFocus([one],now,5);
 assert.equal(items.length,1);
 assert.match(items[0].countercase,/not an accepted/);
 assert.equal(items[0].sourcePublishedAt,one.source_published_at);
 assert.deepEqual(items[0].navigationTags,["hormuz","energy"]);
 assert.equal(researchForPublicLens(items,"hormuz").length,1);
 assert.equal(researchForPublicLens(items,"energy").length,1);
 assert.equal(researchForPublicLens(items,"ai").length,0);
});
test("source dates drive recency, not late owner approval; no future or unsupported content",()=>{
 const bad=[
  {...one,verification_label:"SOURCE_VERIFIED"},
  {...one,source_published_at:"2026-10-20T08:00:00Z"},
  {...one,source_published_at:"2026-11-04T08:00:00Z"},
  {...one,source_retrieved_at:"2026-11-03T08:00:00Z"},
  {...one,published_at:"2026-11-03T08:00:00Z"},
  {...one,published_at:"2026-11-01T07:00:00Z"},
  {...one,source_links:[]},
  {...one,source_links:[null]},
  {...one,source_links:[{url:"javascript:alert(1)",kind:"REPORTING",label:"False source"}]},
 ];
 for(const entry of bad)assert.equal(projectPublishedResearchFocus([entry as PublicMacroPulseBrief],now).length,0,JSON.stringify(entry).slice(0,100));
 const older={...one,source_published_at:"2026-10-29T08:00:00Z",source_retrieved_at:"2026-10-29T08:10:00Z"};
 assert.equal(projectPublishedResearchFocus([older],now).length,1);
 assert.equal(projectPublishedResearchFocus([one],new Date("2026-11-09T08:00:01Z")).length,0);
});
test("latest SOURCE event wins; repeated editorial deliveries do not flood public shelf",()=>{
 const later={...one,id:"504519b6-7a94-8118-b347-d363f9b215a9",
 source_pulse_id:"2026-11-02-0400-iran-hormuz-conditional-opening",
 source_published_at:"2026-11-02T04:00:00Z",
 source_retrieved_at:"2026-11-02T04:10:00Z",
 published_at:"2026-11-02T04:40:00Z"};
 const items=projectPublishedResearchFocus([one,later,one],now);
 assert.deepEqual(items.map(x=>x.id),[later.id,one.id]);
 assert.equal(projectPublishedResearchFocus([one],now,9).length,0);
});
test("each public page has dynamic reviewed research, not an automatic SOURCE_VERIFIED upgrade",()=>{
 const read=(s:string)=>readFileSync(new URL("../"+s,import.meta.url),"utf8");
 for(const file of ["app/blue-desk/page.tsx","app/blue-desk/newsroom/page.tsx",
  "app/blue-desk/markets/page.tsx","app/blue-desk/hormuz/page.tsx"]){
  const source=read(file);
  assert.match(source,/PublishedResearchDispatches/);
  assert.match(source,/projectPublishedResearchFocus/);
 }
 const shared=read("components/blue-desk/PublishedResearchDispatches.tsx");
 assert.match(shared,/RESEARCH-DERIVED · NOT CANONICAL/);
 assert.match(shared,/not independently source-verified breaking news/);
 assert.match(shared,/item\.sourceLinks/);
 const reader=read("lib/blue-desk-macropulse-brief-server.ts");
 assert.match(reader,/\.eq\("status","published"\)/);
 assert.doesNotMatch(reader,/createSupabaseAdminClient/);
});
