import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {expectedIssuerReceiptGaps} from "../lib/scheduled-issuer-receipt-coverage.ts";
import {getFourSlotResearchHealth} from "../lib/research-schedule-health.ts";
import type {IntakeItemInput} from "../lib/research-update.ts";

const after=new Date("2026-10-30T01:30:00.000Z");
function receipt(overrides:Partial<IntakeItemInput>={}):IntakeItemInput {
 return {
  itemKey:"official-press:verified-source-fixture",
  itemType:"news",publisher:"Amazon Investor Relations",
  title:"Amazon Reports Third Quarter 2026 Financial Results",
  url:"https://ir.aboutamazon.com/news-release/2026/amazon-third-quarter-results",
  publishedAt:"2026-10-29T20:59:00Z",summary:"Official source figures",
  sourceQuality:95,relevance:90,novelty:80,materiality:88,
  recommendedAction:"collect_evidence",...overrides,
 };
}
test("expected US issuer results do not trigger before the official due clock",()=>{
 const gaps=expectedIssuerReceiptGaps({items:[]},new Date("2026-10-29T19:00:00Z"));
 assert.equal(gaps.some(x=>x.includes(":AMZN:")),false);
 assert.equal(gaps.some(x=>x.includes(":INTC:")),false);
 assert.equal(gaps.some(x=>x.includes(":SNDK:")),false);
});
test("Oct 29 after-close reports are caught even when public static scorecards exist",()=>{
 const gaps=expectedIssuerReceiptGaps({items:[]},after);
 assert.ok(["AMZN","INTC","SNDK","GOOGL","MSFT"].every(
  x=>gaps.some(g=>g.includes(":"+x+":"))));
 assert.ok(gaps.every(x=>x.startsWith("AUTO_COVERAGE_GAP:ISSUER_ORIGINAL_RELEASE:")));
});
test("creator, republisher and announcement-only items cannot clear an issuer gap",()=>{
 const candidates=[
  receipt({itemKey:"feed:investing-com:mock"}),
  receipt({url:"https://www.investing.com/news/amazon-quarter"}),
  receipt({title:"Amazon Announces Date of Third Quarter 2026 Earnings Call"}),
  receipt({publishedAt:"2026-01-01T20:59:00Z"}),
 ];
 for(const item of candidates){
  assert.ok(expectedIssuerReceiptGaps({items:[item]},after).some(x=>x.includes(":AMZN:")));
 }
 const verified=expectedIssuerReceiptGaps({items:[receipt()]},after);
 assert.equal(verified.some(x=>x.includes(":AMZN:")),false);
 assert.ok(verified.some(x=>x.includes(":SNDK:")));
});
test("dated CoreWeave future event remains pending, and source gap expires after bounded window",()=>{
 const before=expectedIssuerReceiptGaps({items:[]},new Date("2026-11-10T19:00:00Z"));
 assert.equal(before.some(x=>x.includes(":CRWV:")),false);
 const due=expectedIssuerReceiptGaps({items:[]},new Date("2026-11-11T02:00:00Z"));
 assert.ok(due.some(x=>x.includes(":CRWV:")));
 const expired=expectedIssuerReceiptGaps({items:[]},new Date("2026-11-15T12:00:00Z"));
 assert.equal(expired.some(x=>x.includes(":CRWV:")),false);
});
test("scheduled publisher warnings degrade source completeness without labelling source-gate failure",()=>{
 const run=(slot:"morning"|"evening",date:string,warnings:string[])=>({
  schedule_slot:slot,scheduled_for:date,completed_at:date,
  status:"completed" as const,evidence_gate_passed:true,required_sources_complete:true,
  source_checks:[{source:"axios",status:"checked"},{source:"zerohedge",status:"checked"}],
  warnings,updates_published:0,
 });
 const now=new Date("2026-10-30T16:10:00Z");
 const health=getFourSlotResearchHealth([
  run("morning","2026-10-30T01:30:00Z",
   ["AUTO_COVERAGE_GAP:ISSUER_ORIGINAL_RELEASE:AMZN:Q3_2026"]),
  run("evening","2026-10-30T13:30:00Z",[]),
 ],now,true);
 assert.equal(health.state,"attention");
 assert.equal(health.slots[0].status,"degraded");
 assert.equal(health.slots[1].status,"complete");
});
test("existing scheduled research route carries diagnostic into persisted warnings",()=>{
 const acquire=readFileSync(new URL("../lib/firecrawl-scheduled-research.ts",import.meta.url),"utf8");
 const publish=readFileSync(new URL("../app/api/research-update/route.ts",import.meta.url),"utf8");
 assert.match(acquire,/expectedIssuerReceiptGaps\(recovered,now\)/);
 assert.match(publish,/if\(isScheduledInternalRequest && Array\.isArray\(input\.automationCoverageAlerts\)\)/);
 assert.match(publish,/warnings\.push\(\.\.\.new Set\(safe\.slice\(0,20\)\)\)/);
});
