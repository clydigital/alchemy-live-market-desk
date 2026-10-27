import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";

const get=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("every deeply revised 27 October HTML has a distinct grounded private Drive ID",()=>{
 const s=get("app/my-reports/page.tsx");
 const ids=[
 "1sgr-FQnXyHglh53hL1n06M88QpUWHGRz",
 "15cggQ-TRb4W2Jy4vqjFaXCSJWLVbxbYX",
 "15vGOFXyIU2pGCufoR8vR2EjLCfNI1hfI",
 "1Ku7KBSLeIQwxB1plXXTrWmdy6YEmPks9",
 "16aWhqFWKZbglodASWyAUN2gkXDkCjKV1",
 "1SEhaX-h-vSYGpLiHqlnGLKOlGO8f7kPe",
 ];
 assert.equal(new Set(ids).size,6);
 for(const id of ids) assert.equal(s.split('id:"'+id+'"').length,2,"Missing or duplicated source ID "+id);
 assert.match(s,/Four separate HTML collections/);
 assert.match(s,/kind:"audits"/);
 assert.match(s,/PAGE_SIZE=2/);
 assert.match(s,/data-library-page=\{currentPage\}/);
 assert.match(s,/https:\/\/drive\.google\.com\/drive\/folders\/19r-RATOo0vn89FDzs4UZBptPpm1Z9w5L/);
});
test("deep-report contract gives creator, market and article engines separate source gates",()=>{
 const s=get("docs/editorial/BLUEBELLY_HTML_DEEP_REPORT_V3.md");
 for(const text of ["Source packet before writing","Creator batch","Writing Brain",
  "Research Gap","publication","not word quotas","event","UNKNOWN",
  "SOURCE", "click-to-load","natural scheduled run"]){
  assert.match(s.toLowerCase(),new RegExp(text.toLowerCase()));
 }
 assert.match(s,/do not automatically fetch new reports/i);
});
test("V3 private archive does not change public host or legacy owner PDF auth boundaries",()=>{
 const page=get("app/my-reports/page.tsx");
 assert.equal(blueDeskHostAccess("/my-reports","bluebelly-desk.vercel.app"),"private");
 assert.equal(blueDeskHostAccess("/my-reports","alchemy-live-market-desk.vercel.app"),"private");
 assert.match(page,/data-my-desk-pdf-legacy="hidden-by-default"/);
 assert.match(page,/<OwnerAutomaticReportReader\/>/);
 assert.match(page,/<OwnerEditorialSlatePdfReader\/>/);
 assert.match(page,/robots:\{index:false,follow:false\}/);
 assert.doesNotMatch(page,/createSupabaseAdminClient|generateContent\(/);
});
