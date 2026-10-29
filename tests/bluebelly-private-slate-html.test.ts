import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";
import {parseEditorialSlate} from "../lib/editorial-slate-core.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("Writing Brain's latest saved slate renders directly as private HTML, never inferred as a published article",()=>{
 const page=read("app/my-reports/page.tsx");
 const view=read("components/blue-desk/OwnerEditorialSlateHtml.tsx");
 assert.match(page,/getLatestEditorialSlate\(\)/);
 assert.match(page,/<OwnerEditorialSlateHtml slate=\{liveSlate.slate\} status=\{liveSlate.status\}\/>/);
 assert.match(view,/data-owner-editorial-slate-html="private-read-only"/);
 for(const field of ["catalystTimeline","expectation","priceReaction","mechanism",
  "countercase","nextTrigger","chartGuidance","missingProof","sourceUrls"])
  assert.ok(view.includes("idea."+field),field);
 assert.match(view,/PARTIAL VERIFICATION/);
 assert.match(view,/slate.ageLabel/);
 assert.match(view,/target="_blank" rel="noopener noreferrer"/);
 assert.doesNotMatch(view,/dangerouslySetInnerHTML|generateContent|createSupabaseAdminClient/);
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
 assert.match(read("app/my-reports/page.tsx"),/getPrivateHtmlEditions/);
 assert.match(read("app/my-reports/page.tsx"),/data-my-desk-pdf-legacy="hidden-by-default"/);
 assert.doesNotMatch(read("vercel.json"),/bluebelly-html-slate/);
});
