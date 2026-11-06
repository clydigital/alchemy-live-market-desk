import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";
import {parseEditorialSlate,inspectWritingBrainHandoff} from "../lib/editorial-slate-core.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("My Desk no longer renders report-derived ideas; their verified research data remains independently protected",()=>{
 const page=read("app/my-reports/page.tsx");
 const view=read("components/blue-desk/OwnerDailyTopicIdeas.tsx");
 const server=read("lib/bluebelly-owner-report-led-ideas.ts");
 assert.doesNotMatch(page,/OwnerDailyTopicIdeas|OwnerDailyIntelligenceHome|OwnerDailyReportAttachments/);
 assert.match(page,/data-private-desk="source-first-market-workspace"/);
 assert.doesNotMatch(page,/getLatestEditorialSlate|OwnerEditorialSlateHtml|OwnerEditorialSlatePdfReader/);
 assert.match(view,/DAILY_REPORT|daily-report-linked|current-three-ideas/);
 assert.match(view,/Antithesis:/);
 assert.match(view,/What to look for:/);
 assert.match(view,/Original source/);
 assert.match(server,/app_access_allowlist/);
 assert.match(server,/digest\(data\.html_content\)/);
 assert.equal(blueDeskHostAccess("/my-reports","bluebelly-desk.vercel.app"),"private");
 const valid=parseEditorialSlate({day_myt:"2026-10-29",
  produced_at:"2026-10-29T01:29:00Z",verification_status:"partial",
  notes:"Review first",sources:[],ideas:[1,2,3].map(x=>({
   title:"Scenario "+x,hook:"Investigate the rate decision",mechanism:"A lower yield could ease financing",
   priceReaction:"UNKNOWN",missingProof:"Time-matched close unavailable",
   sourceUrls:["https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"]
  }))},"2026-10-29T03:00:00Z");
 assert.ok(valid);
 assert.equal(valid?.ideas.length,3);
 assert.equal(valid?.ideas[0].priceReaction,"UNKNOWN");
 assert.equal(valid?.verificationStatus,"partial");
});

test("Legacy PDF runs default to off while existing research cron and HTML paths remain enabled",()=>{
 const morning=read("app/api/cron/research/morning-dossier/route.ts");
 const evening=read("app/api/cron/research/evening-dossier/route.ts");
 const gap=read("app/api/cron/research-gap/handoff/route.ts");
 const retry=read("lib/blue-desk-automated-report-late-handoff.ts");
 for(const route of [morning,evening]){
  assert.match(route,/process.env.BLUEBELLY_ENABLE_LEGACY_PDF==="true"/);
  assert.match(route,/handleScheduledPostResearchDossier/);
 }
 assert.match(gap,/process.env.BLUEBELLY_ENABLE_LEGACY_PDF==="true"/);
 assert.match(gap,/handleScheduledResearchGapHandoff/);
 assert.match(retry,/process.env.BLUEBELLY_ENABLE_LEGACY_PDF!=="true"/);
 assert.doesNotMatch(read("app/my-reports/page.tsx"),/OwnerDailyIntelligenceHome|OwnerDailyTopicIdeas/);
 assert.doesNotMatch(read("app/my-reports/page.tsx"),/data-my-desk-pdf-legacy="hidden-by-default"/);
 assert.doesNotMatch(read("vercel.json"),/bluebelly-html-slate/);
});

test("Writing Brain missing evidence arrays are preserved, not silently discarded",()=>{
 const parsed=parseEditorialSlate({day_myt:"2026-11-05",produced_at:"2026-11-05T01:40:00Z",
  verification_status:"partial",notes:"Private review",sources:[],
  ideas:[1,2,3].map(i=>({
   ideaId:"2026-11-05-0"+i,title:"Candidate "+i,hook:"Dated source",
   mechanism:"Financing costs change",countercase:"Demand could persist",
   nextTrigger:"Official follow-up",sourceUrls:["https://www.federalreserve.gov/"],
   missingProof:["Matched quote missing","Forecast vintage unverified"],
  })),
 },"2026-11-05T02:10:00Z");
 assert.ok(parsed);
 assert.equal(parsed.ideas[0].missingProof,"Matched quote missing; Forecast vintage unverified");
 assert.equal(parsed.ideas[2].ideaId,"2026-11-05-03");
 assert.deepEqual(inspectWritingBrainHandoff(parsed,new Date("2026-11-05T02:10:00Z")),{
  state:"CURRENT_PARTIAL",dayMyt:"2026-11-05",linkedIdeaCount:3,hasThreeDistinctIds:true,
 });
 const verified={...parsed,verificationStatus:"source_checked" as const};
 assert.equal(inspectWritingBrainHandoff(verified,new Date("2026-11-05T02:10:00Z")).state,
  "CURRENT_PERSISTED");
 assert.equal(inspectWritingBrainHandoff({...verified,notes:"RECOVERY_BACKFILL from prior scheduled failure"},
  new Date("2026-11-05T02:10:00Z")).state,"MANUAL_RECOVERY");
 const duplicate={...verified,ideas:verified.ideas.map(x=>({...x,ideaId:"same-idea"}))};
 assert.equal(inspectWritingBrainHandoff(duplicate,new Date("2026-11-05T02:10:00Z")).state,
  "CURRENT_PARTIAL");
});

test("Writing Brain only flags missed delivery after its 09:30 MYT Mon-Sat window",()=>{
 assert.equal(inspectWritingBrainHandoff(null,new Date("2026-11-05T01:20:00Z")).state,
  "NOT_DUE"); // 09:20 MYT
 assert.equal(inspectWritingBrainHandoff(null,new Date("2026-11-05T01:59:00Z")).state,
  "NOT_DUE"); // 09:59 MYT
 assert.equal(inspectWritingBrainHandoff(null,new Date("2026-11-05T02:00:00Z")).state,
  "MISSING"); // 10:00 MYT
 assert.equal(inspectWritingBrainHandoff(null,new Date("2026-11-07T16:00:00Z")).state,
  "NOT_SCHEDULED"); // Sun 00:00 MYT
 const old=parseEditorialSlate({day_myt:"2026-11-04",produced_at:"2026-11-04T01:30:00Z",
  verification_status:"partial",notes:"",sources:[],
  ideas:[1,2,3].map(i=>({title:"Old "+i,hook:"Historical",sourceUrls:[]}))
 },"2026-11-05T02:00:00Z");
 assert.equal(inspectWritingBrainHandoff(old,new Date("2026-11-05T02:00:00Z")).state,
  "MISSING");
});
