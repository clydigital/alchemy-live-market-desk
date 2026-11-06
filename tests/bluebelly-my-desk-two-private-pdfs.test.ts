import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("private My Desk exposes market and research shortcuts, not duplicate report interfaces",()=>{
 const page=read("app/my-reports/page.tsx");
 assert.match(page,/data-private-desk="source-first-market-workspace"/);
 assert.doesNotMatch(page,/OwnerPortfolioHome|href="\/my-reports\?view=portfolio"/);
 assert.doesNotMatch(page,/OwnerDailyIntelligenceHome|OwnerDailyTopicIdeas|OwnerDailyReportAttachments|OwnerPrivatePdfInputHealth/);
 assert.match(page,/data-my-desk-primary="market-research-shortcuts"/);
 assert.match(page,/href="\/market-tools"/);
 assert.match(page,/href="\/owner\/research"/);
 assert.doesNotMatch(page,/OwnerAutomaticReportReader|OwnerEditorialSlatePdfReader|data-drive-archive|PAGE_SIZE|CATEGORIES\.map/);
 assert.doesNotMatch(page,/generateContent|createSupabaseAdminClient/);
});
test("retired presenter and editorial pages redirect to authenticated My Desk",()=>{
 const header=read("components/blue-desk/BlueDeskHeader.tsx");
 const nav=header.split("const PRIVATE_NAV = [")[1]?.split("] as const;")[0]||"";
 assert.match(nav,/\["My Desk", "\/my-reports"\]/);
 assert.doesNotMatch(nav,/Presenter Prep|Writing Studio/);
 const publicNav=header.split("const PUBLIC_NAV = [")[1]?.split("] as const;")[0]||"";
 assert.doesNotMatch(publicNav,/\["My Desk", "\/my-reports"\]/);
 assert.match(header, /<Link className=\{chrome\.micro\} href="\/my-reports">My Desk/);
 assert.doesNotMatch(publicNav,/Presenter Prep/);
 for(const path of ["app/owner/presenter/page.tsx","app/owner/editorial/page.tsx"]){
  const old=read(path);
  assert.match(old,/redirect\("\/my-reports"\)/);
  assert.doesNotMatch(old,/EditorialWorkbench|PresenterTechnicalChecks|OwnerTodayTalk/);
 }
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
