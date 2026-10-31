import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {computeMaterialEditorialRecall,materialEventKey} from "../lib/bluebelly-material-editorial-recall.ts";
import {attachXWireResearchLeads} from "../lib/x-wire-scheduled-research-leads.ts";
import type {ResearchRunInput} from "../lib/research-update.ts";

const run:ResearchRunInput={runKey:"recall-test",scheduleSlot:"morning",
 scheduledFor:"2026-10-27T01:00:00Z",sourceChecks:[],items:[],summary:"Original research checked"};
const now=new Date("2026-10-27T03:00:00Z");
const slate={dayMyt:"2026-10-27",producedAt:"2026-10-27T01:00:00Z",
 ideas:[
 {title:"Broadcom and partners arrange $63bn financing for Anthropic compute"},
 {title:"Meta proposes $35bn share sale"},
 {title:"BOJ producer-services prices"},
 ],notes:"Research Gap partial"};
const anthology={title:"Anthropic files S-1 prospectus ahead of IPO",
 url:"https://www.sec.gov/Archives/edgar/data/2130357/000162828026067168/0001628280-26-067168-index.html",
 publishedAt:"2026-10-26T13:00:11Z",itemKey:"official-edgar:abc",sourceQuality:95,materiality:95};
const merger={title:"Tesla and SpaceX special committees explore merger",
 url:"https://www.axios.com/2026/10/20/spacex-tesla-merger-talks",
 publishedAt:"2026-10-20T21:43:40Z",itemKey:"feed:axios:abc",sourceQuality:76,materiality:90};
test("Anthropic SEC IPO is unacknowledged by Broadcom financing selection",()=>{
 const rec=computeMaterialEditorialRecall([anthology],slate,now);
 assert.equal(rec.length,1);
 assert.equal(rec[0].key,"anthropic:ipo");
 assert.equal(rec[0].status,"unacknowledged");
 assert.equal(rec[0].sourceState,"original_checked");
});
test("explicit excluded source receipt accounts for same Anthropic event without promoting it",()=>{
 const rec=computeMaterialEditorialRecall([anthology],
  {...slate,notes:"RECALL[ANTHROPIC:IPO]=EXCLUDED — stronger earnings angle"},
  now);
 assert.equal(rec[0].status,"excluded_with_reason");
});
test("Tesla SpaceX reported merger is not a signed deal, not silently dropped",()=>{
 const t=new Date("2026-10-21T05:00:00Z");
 const rec=computeMaterialEditorialRecall([merger],
  {...slate,producedAt:"2026-10-21T06:00:00Z"},t);
 assert.equal(rec.length,1);
 assert.match(rec[0].key,/merger/);
 assert.equal(rec[0].status,"unacknowledged");
 assert.equal(rec[0].sourceState,"reported_only");
 assert.notEqual(rec[0].sourceState,"original_checked");
});
test("post cutoff candidate is labelled next edition, not retroactively missed",()=>{
 const rec=computeMaterialEditorialRecall([{...anthology,publishedAt:"2026-10-27T02:00:00Z"}],slate,now);
 assert.equal(rec[0].status,"post_cutoff");
});
test("future and stale leads fail closed; reports not verified by high materiality",()=>{
 assert.equal(computeMaterialEditorialRecall([
  {...anthology,publishedAt:"2026-11-04T00:00:00Z"},
  {...merger,publishedAt:"2026-10-10T00:00:00Z"}
 ],slate,now).length,0);
 assert.equal(materialEventKey("Broadcom equipment financing for Anthropic compute"),"anthropic:financing");
 assert.equal(materialEventKey("Anthropic files IPO registration"),"anthropic:ipo");
});
test("scheduled X provider mirror keeps 3rd party tweet as low-quality unverified lead",()=>{
 const wire={
  storageHealthy:true,
  accounts:[{handle:"HFI_Research",status:"healthy"}],
  posts:[{id:"2113177723749420056",url:"https://x.com/HFI_Research/status/2113177723749420056",
   handle:"HFI_Research",publishedAt:"2026-10-27T01:00:00Z",
   text:"Reports claim a Tesla SpaceX merger may be reviewed by special committees; verify in original documents.",
   images:[],quoteUrl:null,attribution:"THIRD_PARTY_ONLY",intakeStatus:"discovery"}]
 };
 const out=attachXWireResearchLeads(run,wire as never,now);
 assert.equal(out.items.length,1);
 assert.equal(out.items[0].sourceQuality,35);
 assert.equal(out.items[0].recommendedAction,"collect_evidence");
 assert.equal(out.items[0].evidence?.length,0);
 assert.match(out.items[0].reviewReason||"",/unverified/i);
});
test("private Drive receipts keep PDF proof and no public browser grants",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261028120000_private_drive_html_report_receipts.sql",import.meta.url),"utf8");
 assert.match(sql,/file_format in \('pdf','html'\)/);
 assert.match(sql,/file_format='pdf' and pdf_path is not null and pdf_sha256 is not null/);
 assert.match(sql,/file_format='html' and html_drive_id is not null/);
 assert.match(sql,/revoke all on public\.blue_desk_automated_reports from anon,authenticated/);
 assert.match(sql,/unique\(report_day,slot,report_kind,edition_key\)/);
 const source=readFileSync(new URL("../app/my-reports/page.tsx",import.meta.url),"utf8");
 assert.match(source,/OwnerDailyIntelligenceHome/);
 assert.match(source,/OwnerDailyTopicIdeas/);
 assert.doesNotMatch(source,/getPrivateHtmlEditions|getOwnerMaterialRecall|data-material-editorial-recall/);
});
test("existing research cadence invokes X on 2 existing slots only",()=>{
 const s=readFileSync(new URL("../lib/firecrawl-scheduled-research.ts",import.meta.url),"utf8");
 assert.match(s,/if \(slot==="morning" \|\| slot==="evening"\)/);
 assert.match(s,/getXWireDurable\(\{now\}\)/);
 assert.match(s,/attachXWireResearchLeads\(originalFilings,wire,now\)/);
});
