import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("legacy PDF readers cannot put ready HTML rows in PDF iframes or download links",()=>{
 const reader=read("lib/blue-desk-automated-report-reader.ts");
 const pdfBlocks=reader.split("export async function");
 for(const block of pdfBlocks){
  if(/getOwnerAutomaticDailyReports|getOwnerEditorialSlatePdfs/.test(block)){
   assert.match(block,/\.eq\("file_format","pdf"\)/);
   assert.match(block,/\.not\("pdf_path","is",null\)/);
  }
  if(/getOwnerLatestDailyPdfAttempt|getOwnerLatestSlatePdfAttempt/.test(block)){
   assert.match(block,/\.eq\("file_format","pdf"\)/);
  }
 }
 const api=read("app/api/owner/automated-report-pdf/route.ts");
 assert.match(api,/\.eq\("file_format","pdf"\)/);
 assert.match(api,/data\.pdf_path!==exact/);
 assert.match(api,/app_access_allowlist/);
});

test("private HTML reader reports actual saved session coverage without promoting a research draft",()=>{
 const page=read("components/blue-desk/OwnerDailyIntelligenceHome.tsx");
 assert.match(page,/expectedCompletedUsWeekdaySessionDay/);
 assert.match(page,/privateDailySessionCoverage/);
 assert.match(page,/data-private-daily-report-coverage=/);
 assert.match(page,/holidays and early closes can differ/);
 assert.match(page,/A saved report is a private draft/);
 assert.doesNotMatch(page,/latest\.reportDay!==todayMYT/);
 const work=read("lib/bluebelly-owner-daily-intelligence.ts");
 assert.match(work,/app_access_allowlist/);
 assert.match(work,/\.eq\("owner_user_id",user\.id\)/);
});
