import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";
const get=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("legacy 27 October Drive editions are absent from the new My Desk archive",()=>{
 const s=get("app/my-reports/page.tsx");
 for(const id of ["1sgr-FQnXyHglh53hL1n06M88QpUWHGRz",
 "15cggQ-TRb4W2Jy4vqjFaXCSJWLVbxbYX",
 "15vGOFXyIU2pGCufoR8vR2EjLCfNI1hfI",
 "1Ku7KBSLeIQwxB1plXXTrWmdy6YEmPks9",
 "16aWhqFWKZbglodASWyAUN2gkXDkCjKV1",
 "1SEhaX-h-vSYGpLiHqlnGLKOlGO8f7kPe"])
  assert.ok(!s.includes(id),"Old Drive edition must not appear on My Desk "+id);
 assert.match(s,/OwnerDailyTopicIdeas/);
 assert.doesNotMatch(s,/PAGE_SIZE|data-library-page|CATEGORIES|drive.google.com/);
});
test("deep-report contract gives creator, market and article engines separate source gates",()=>{
 const s=get("docs/editorial/BLUEBELLY_HTML_DEEP_REPORT_V3.md");
 for(const text of ["Source packet before writing","Creator batch","Writing Brain",
  "Research Gap","publication","not word quotas","event","UNKNOWN",
  "SOURCE", "click-to-load","natural scheduled run"]){
  assert.match(s.toLowerCase(),new RegExp(text.toLowerCase()));
 }
 assert.match(s,/does not automatically fetch new reports/i);
});
test("V3 private archive does not change public host or legacy owner PDF auth boundaries",()=>{
 const page=get("app/my-reports/page.tsx");
 assert.equal(blueDeskHostAccess("/my-reports","bluebelly-desk.vercel.app"),"private");
 assert.equal(blueDeskHostAccess("/my-reports","alchemy-live-market-desk.vercel.app"),"private");
 assert.doesNotMatch(page,/data-my-desk-pdf-legacy|OwnerAutomaticReportReader|OwnerEditorialSlatePdfReader/);
 assert.match(page,/<OwnerDailyIntelligenceHome\/>/);
 assert.match(page,/<OwnerDailyTopicIdeas\/>/);
 assert.match(page,/robots:\{index:false,follow:false\}/);
 assert.doesNotMatch(page,/createSupabaseAdminClient|generateContent\(/);
});
