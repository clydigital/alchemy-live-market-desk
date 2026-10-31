import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";
import {parseEditorialSlate} from "../lib/editorial-slate-core.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("the private My Desk shows only latest report-linked ideas, not stale saved slate HTML",()=>{
 const page=read("app/my-reports/page.tsx");
 const view=read("components/blue-desk/OwnerDailyTopicIdeas.tsx");
 const server=read("lib/bluebelly-owner-report-led-ideas.ts");
 assert.match(page,/<OwnerDailyTopicIdeas\/>/);
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
 assert.match(read("app/my-reports/page.tsx"),/OwnerDailyIntelligenceHome/);
 assert.doesNotMatch(read("app/my-reports/page.tsx"),/data-my-desk-pdf-legacy="hidden-by-default"/);
 assert.doesNotMatch(read("vercel.json"),/bluebelly-html-slate/);
});
