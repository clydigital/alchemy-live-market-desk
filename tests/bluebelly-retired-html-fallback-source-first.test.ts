import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {scheduledDailyHtmlFallbackEnabled} from "../lib/bluebelly-daily-html-fallback-gate.ts";
import {parseEditorialSlate,inspectWritingBrainHandoff} from "../lib/editorial-slate-core.ts";

const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("legacy HTML generation is disabled unless explicitly opted into, without blocking Research Gap",()=>{
 const base={NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED:"true"};
 assert.equal(scheduledDailyHtmlFallbackEnabled(base),false);
 assert.equal(scheduledDailyHtmlFallbackEnabled({...base,BLUEBELLY_DAILY_HTML_FALLBACK_ENABLED:"false"}),false);
 assert.equal(scheduledDailyHtmlFallbackEnabled({...base,BLUEBELLY_DAILY_HTML_FALLBACK_ENABLED:"TRUE"}),false);
 assert.equal(scheduledDailyHtmlFallbackEnabled({BLUEBELLY_DAILY_HTML_FALLBACK_ENABLED:"true"}),false);
 assert.equal(scheduledDailyHtmlFallbackEnabled({...base,BLUEBELLY_DAILY_HTML_FALLBACK_ENABLED:"true",BLUEBELLY_DAILY_HTML_FALLBACK_DISABLED:"true"}),false);
 assert.equal(scheduledDailyHtmlFallbackEnabled({...base,BLUEBELLY_DAILY_HTML_FALLBACK_ENABLED:"true"}),true);
 const route=read("app/api/cron/research-gap/handoff/route.ts");
 const job=read("lib/bluebelly-scheduled-daily-html-job.ts");
 assert.match(route,/scheduledDailyHtmlFallbackEnabled/);
 assert.match(route,/handleScheduledResearchGapHandoff/);
 assert.match(route,/runPrivateDailyHtmlFallback/);
 assert.ok(route.indexOf("scheduledDailyHtmlFallbackEnabled(process.env)")<route.indexOf("runPrivateDailyHtmlFallback(request,now)"));
 assert.match(job,/scheduledDailyHtmlFallbackEnabled/);
 assert.doesNotMatch(route,/\.insert\(|\.upsert\(|generateContent/);
});

test("Writing Brain can persist source-qualified three-idea slates without a Daily Intelligence parent",()=>{
 const row={
  day_myt:"2026-11-06",produced_at:"2026-11-06T01:35:00Z",
  verification_status:"source_checked",notes:"original source readback only",
  sources:["https://www.federalreserve.gov/monetarypolicy.htm"],
  ideas:[1,2,3].map(i=>({
   ideaId:"2026-11-06-0"+i,title:"Distinct candidate "+i,
   format:i===1?"COTD":"OB",hook:"Original dated release, investor question",
   catalystTimeline:"6 November original",expectation:"UNKNOWN",
   priceReaction:"UNKNOWN",mechanism:"Potential impact on financing",
   countercase:"Demand alternative is plausible",
   nextTrigger:"Next dated official comparison",
   chartGuidance:["Check source-dated prices before drawing conclusions"],
   sourceUrls:["https://www.federalreserve.gov/monetarypolicy.htm"],
   missingProof:"Event-matched reaction not available",
  })),
 };
 const parsed=parseEditorialSlate(row,"2026-11-06T02:35:00Z");
 assert.ok(parsed);
 assert.equal(parsed.ideas.length,3);
 assert.ok(parsed.ideas.every(x=>!x.parentReportId&&!x.parentReportSha256&&!x.reportSessionET));
 const verdict=inspectWritingBrainHandoff(parsed,new Date("2026-11-06T02:35:00Z"));
 assert.equal(verdict.state,"CURRENT_PERSISTED");
 assert.equal(verdict.linkedIdeaCount,3);
 assert.equal(verdict.hasThreeDistinctIds,true);
 const incomplete={...row,ideas:row.ideas.map(x=>({...x,sourceUrls:[]}))};
 const parsedIncomplete=parseEditorialSlate(incomplete,"2026-11-06T02:35:00Z");
 assert.equal(inspectWritingBrainHandoff(parsedIncomplete,new Date("2026-11-06T02:35:00Z")).state,"CURRENT_PARTIAL");
});
