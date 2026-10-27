import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("the existing My Desk private route leads with the two permitted PDF outputs",()=>{
 const page=read("app/my-reports/page.tsx");
 assert.match(page,/data-private-desk="two-pdf-deliverables"/);
 assert.match(page,/Market stories, explained/);
 assert.match(page,/Three article opportunities/);
 assert.match(page,/<OwnerAutomaticReportReader\/>/);
 assert.match(page,/<OwnerEditorialSlatePdfReader\/>/);
 assert.match(page,/data-my-desk-technical="collapsed-by-default"/);
 assert.match(page,/data-drive-archive="kqdocuments88-private"/);
 assert.match(page,/drive.google.com\/drive\/folders\/19r-RATOo0vn89FDzs4UZBptPpm1Z9w5L/);
 assert.match(page,/drive.google.com\/file\/d\/1vrlz5BO25HNTDFsftQQNb_Q0wsysRhhm/);
 assert.match(page,/drive.google.com\/file\/d\/1eXurYRfogx7M88BRvpo8KZF6ycfh-8Ao/);
 assert.match(page,/docs.google.com\/document\/d\/12ZTqOZn86wxuInqfscBAnDS3-u63ONPcKh-VsDxRfME/);
 assert.match(page,/docs.google.com\/document\/d\/1bFDxSyT8gSfwEiztfNHQZXL-8bCl8XQEd07jHV3Ksqc/);
 assert.match(page,/dated links are the 27 October pilot/);
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
