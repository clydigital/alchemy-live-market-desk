import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {reconcileOwnerIdeaHandoff} from "../lib/bluebelly-my-desk-handoff.ts";
import {projectPersistedWritingBrainIdeas} from "../lib/bluebelly-my-desk-suggestions.ts";
import type {EditorialSlate} from "../lib/editorial-slate-core.ts";

const parent={
 id:"00525058-9d5d-4016-ad51-ce1844f1c200",
 htmlSha256:"a".repeat(64),
 reportDay:"2026-11-04",
};
const idea=(i:number)=>({
 rank:i as 1|2|3,ideaId:"2026-11-05-0"+i,
 parentReportId:parent.id,parentReportSha256:parent.htmlSha256,
 reportSessionET:parent.reportDay,
 title:"Verified macro candidate "+i,format:(i===2?"COTD":"OB") as "OB"|"COTD",
 hook:"Official source sets the mechanism",
 catalystTimeline:"5 Nov session",expectation:"UNKNOWN",priceReaction:"UNKNOWN",
 mechanism:"Rates can change funding",countercase:"Alternative demand explanation",
 nextTrigger:"Compare official policy and dated market close",
 chartGuidance:["Compare dated yields"],sourceUrls:["https://www.federalreserve.gov/monetarypolicy.htm"],
 missingProof:"Matched price reaction not yet confirmed",
});
const slate=(status:"source_checked"|"partial"="source_checked"):EditorialSlate=>({
 dayMyt:"2026-11-05",producedAt:"2026-11-05T01:35:00Z",
 verificationStatus:status,notes:"Private scheduled research",
 ideas:[1,2,3].map(idea),sources:[],ageLabel:"TODAY",
});
const after=new Date("2026-11-05T02:35:00Z");
test("exact immutable report, session, distinct ideas and links choose persisted Writing Brain",()=>{
 const result=reconcileOwnerIdeaHandoff(parent,slate(),after);
 assert.equal(result.source,"WRITING_BRAIN");
 assert.equal(result.state,"MATCHED_UPSTREAM_SOURCE_CHECKED");
 assert.equal(result.freshness,"CURRENT_US_SESSION");
 assert.equal(result.expectedSessionET,"2026-11-04");
 const ideas=projectPersistedWritingBrainIdeas(slate());
 assert.equal(ideas.length,3);
 assert.equal(ideas[0].provenance,"WRITING_BRAIN");
 assert.equal(ideas[0].ideaId,"2026-11-05-01");
 assert.match(ideas[0].evidenceGap||"",/Matched price reaction/);
 assert.equal(ideas[1].format,"COTD");
});
test("upstream partial and manual backfills never masquerade as a completed scheduled run",()=>{
 assert.equal(reconcileOwnerIdeaHandoff(parent,slate("partial"),after).state,
  "MATCHED_PARTIAL");
 const recovered={...slate(),notes:"RECOVERY_BACKFILL after run failed"};
 assert.equal(reconcileOwnerIdeaHandoff(parent,recovered,after).state,
  "MATCHED_MANUAL_RECOVERY");
});
test("wrong session, report, SHA, duplicate idea IDs and missing proof force disclosed fallback",()=>{
 const cases:EditorialSlate[]=[
  {...slate(),ideas:slate().ideas.map(x=>({...x,parentReportId:"wrong"}))},
  {...slate(),ideas:slate().ideas.map(x=>({...x,parentReportSha256:"b".repeat(64)}))},
  {...slate(),ideas:slate().ideas.map(x=>({...x,reportSessionET:"2026-11-03"}))},
 ];
 for(const c of cases){
  const result=reconcileOwnerIdeaHandoff(parent,c,after);
  assert.equal(result.source,"REPORT_DERIVED");
  assert.equal(result.state,"PARENT_MISMATCH");
 }
 const duplicate={...slate(),ideas:slate().ideas.map(x=>({...x,ideaId:"duplicate"}))};
 assert.equal(reconcileOwnerIdeaHandoff(parent,duplicate,after).state,
  "INCOMPLETE_SLATE");
 const missingUrls={...slate(),ideas:slate().ideas.map(x=>({...x,sourceUrls:[]}))};
 assert.equal(reconcileOwnerIdeaHandoff(parent,missingUrls,after).state,
  "INCOMPLETE_SLATE");
 const future={...slate(),producedAt:"2026-11-05T04:35:00Z"};
 assert.equal(reconcileOwnerIdeaHandoff(parent,future,after).state,"STALE_SLATE");
});
test("missing slate before 10 MYT is pending, not failure; after 10 is missing",()=>{
 const before=reconcileOwnerIdeaHandoff(parent,null,new Date("2026-11-05T01:59:00Z"));
 assert.equal(before.state,"NOT_DUE");
 const overdue=reconcileOwnerIdeaHandoff(parent,null,new Date("2026-11-05T02:01:00Z"));
 assert.equal(overdue.state,"MISSING");
 assert.equal(overdue.source,"REPORT_DERIVED");
});
test("older completed US report stays readable but cannot be labelled current",()=>{
 const oldParent={...parent,reportDay:"2026-11-03"};
 const correctlyOld={...slate(),ideas:slate().ideas.map(x=>({...x,reportSessionET:"2026-11-03"}))};
 const result=reconcileOwnerIdeaHandoff(oldParent,correctlyOld,after);
 assert.equal(result.source,"WRITING_BRAIN");
 assert.equal(result.freshness,"OLDER_US_SESSION");
 const malformed=reconcileOwnerIdeaHandoff(oldParent,slate(),after);
 assert.equal(malformed.state,"PARENT_MISMATCH");
 const ui=readFileSync(new URL("../components/blue-desk/OwnerDailyTopicIdeas.tsx",import.meta.url),"utf8");
 assert.match(ui,/REPORT HANDOFF BEHIND/);
 assert.match(ui,/REPORT-DERIVED FALLBACK/);
 assert.match(ui,/OLDER US SESSION/);
 assert.doesNotMatch(ui,/LIVE REPORT-LED IDEAS|FROM CURRENT DAILY REPORT/);
});
test("private My Desk checks source, parent and site security instead of unqualified task completion",()=>{
 const reader=readFileSync(new URL("../lib/bluebelly-owner-report-led-ideas.ts",import.meta.url),"utf8");
 const health=readFileSync(new URL("../components/blue-desk/OwnerPrivatePdfInputHealth.tsx",import.meta.url),"utf8");
 assert.match(reader,/reconcileOwnerIdeaHandoff\(latest,saved\.slate,now\)/);
 assert.match(reader,/digest\(data\.html_content\)/);
 assert.match(reader,/app_access_allowlist/);
 assert.match(health,/reconcileOwnerIdeaHandoff\(activeParent,lastSlate,now\)/);
 assert.match(health,/OLDER PRIVATE BRIEFS ONLY/);
 assert.match(health,/source_retrieved_at/);
 assert.doesNotMatch(health,/TASK_EXECUTED_SUCCESSFULLY/);
});
