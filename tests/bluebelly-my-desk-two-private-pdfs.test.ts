import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("the existing private My Desk route leads with three HTML editions and maintains legacy PDF",()=>{
 const page=read("app/my-reports/page.tsx");
 assert.match(page,/data-private-desk="html-first-three-formats"/);
 assert.match(page,/Market stories, explained/);
 assert.match(page,/Three article opportunities/);
 assert.match(page,/<OwnerAutomaticReportReader\/>/);
 assert.match(page,/<OwnerEditorialSlatePdfReader\/>/);
 assert.match(page,/data-my-desk-technical="collapsed-by-default"/);
 assert.match(page,/data-drive-archive="kqdocuments88-html-primary"/);
 assert.match(page,/16CKyy1JOrBWHdl93uFo8_dOY2oiZ2f61/);
 assert.match(page,/1oWPq5wrhlpmaK2sP7tsBfAT000kmteaI/);
 assert.match(page,/1ca425cmHacpdGtlebVSAdjh3q_s9lOUd/);
 assert.match(page,/1oFv-vay4nlg85FgGWtbSOnxP4WrHbQVR/);
 assert.match(page,/data-my-desk-pdf-legacy="hidden-by-default"/);
 assert.match(page,/Download HTML/);
 assert.match(page,/data-library-page=\{currentPage\}/);
 assert.match(page,/CATEGORIES\.map/);
 assert.match(page,/pageHref\(activeType,currentPage\+1\)/);
 assert.match(page,/One batch per creator/);
 assert.match(page,/automatic HTML uploads are not yet verified/);
 assert.match(page,/drive.google.com\/drive\/folders\/19r-RATOo0vn89FDzs4UZBptPpm1Z9w5L/);
 assert.match(page,/<OwnerPrivatePdfInputHealth\/>/);
 assert.doesNotMatch(page,/Poster|new Date\(|generateContent|createSupabaseAdminClient/);
});
test("old presenter route remains privately compatible but is not primary navigation",()=>{
 const header=read("components/blue-desk/BlueDeskHeader.tsx");
 const nav=header.split("const PRIVATE_NAV = [")[1]?.split("] as const;")[0]||"";
 assert.match(nav,/\["My Desk", "\/my-reports"\]/);
 assert.doesNotMatch(nav,/Presenter Prep/);
 assert.equal(blueDeskHostAccess("/my-reports","bluebelly-desk.vercel.app"),"private");
 assert.equal(blueDeskHostAccess("/owner/presenter","bluebelly-desk.vercel.app"),"private");
 assert.equal(blueDeskHostAccess("/api/owner/automated-report-pdf","bluebelly-desk.vercel.app"),"private");
 assert.notEqual(blueDeskHostAccess("/owner/private-pdf-debug","bluebelly-desk.vercel.app"),"public");
});
test("each report remains independently authenticated on read and file delivery",()=>{
 const daily=read("components/blue-desk/OwnerAutomaticReportReader.tsx");
 const slate=read("components/blue-desk/OwnerEditorialSlatePdfReader.tsx");
 const stream=read("app/api/owner/automated-report-pdf/route.ts");
 for(const reader of [daily,slate]){
  assert.match(reader,/getUser\(\)/);
  assert.match(reader,/app_access_allowlist/);
  assert.match(reader,/automated-report-pdf\?edition=/);
 }
 assert.match(stream,/app_access_allowlist/);
 assert.match(stream,/getUser\(\)/);
 assert.match(stream,/editorial-pdfs/);
 assert.match(stream,/download/);
});
