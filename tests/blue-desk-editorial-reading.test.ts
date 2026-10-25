import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {approvedEditorialLead} from "../lib/blue-desk-editorial-preview.ts";
import {blueDeskHostAccess,blueDeskPresentationTarget} from "../lib/blue-desk-host.ts";

const id="a2f040b6-1c87-48a4-9fe8-72f54398661a";
test("published editorial previews quote the actual approved article's opening, never add analysis",()=>{
  const copy="# COTD: Oil\n\nBrent is testing an important resistance level. The next reaction matters.\n\nUnverified explanations should not be included.";
  assert.equal(approvedEditorialLead(copy),"Brent is testing an important resistance level. The next reaction matters.");
  assert.equal(approvedEditorialLead("# Title\n\nOnly one line."),"Only one line.");
  const long="First premise is observable. ".repeat(30);
  const preview=approvedEditorialLead(long,210);
  assert.ok(preview.length<=210 && long.startsWith(preview.replace(/…$/,"")));
  assert.equal(approvedEditorialLead("## Heading only"),"");
});

test("editorial-first Key Stories prioritises approved editions and has no expandable boilerplate",()=>{
  const key=readFileSync(new URL("../app/blue-desk/key-stories/page.tsx",import.meta.url),"utf8");
  const daily=readFileSync(new URL("../app/blue-desk/daily-report/page.tsx",import.meta.url),"utf8");
  const library=readFileSync(new URL("../app/blue-desk/reports/page.tsx",import.meta.url),"utf8");
  assert.match(key,/data-editorial-priority="published-only"/);
  assert.match(key,/getLatestPublishedDailyReport/);
  assert.match(key,/listPublishedReports\(4\)/);
  assert.match(key,/approvedEditorialLead\(report\.body,400\)/);
  assert.match(key,/Open approved PDF/);
  assert.match(key,/storyTests/);
  assert.doesNotMatch(key,/<details className=\{ui\.more\}>/);
  assert.match(daily,/Open fixed Daily Report PDF/);
  assert.match(daily,/data-approved-angles="published-only"/);
  assert.match(library,/approvedEditorialLead\(report\.body\)/);
});
test("public access is exact and read-only, unapproved records stay inaccessible",()=>{
  for(const host of ["bluebelly-desk.vercel.app","alchemy-live-market-desk.vercel.app"]){
    assert.equal(blueDeskHostAccess("/reports",host),"public");
    assert.equal(blueDeskHostAccess("/reports/"+id,host),"public");
    assert.equal(blueDeskHostAccess("/reports/"+id+"/pdf",host),"public");
    assert.equal(blueDeskPresentationTarget("/reports/"+id+"/pdf",host),"/blue-desk/reports/"+id+"/pdf");
    for(const path of ["/reports/not-a-uuid","/reports/"+id+"/draft","/api/owner/editorial-publish","/owner/daily-articles","/owner/publications"]){
      assert.notEqual(blueDeskHostAccess(path,host),"public",path);
    }
  }
  const reader=readFileSync(new URL("../lib/editorial-publications-server.ts",import.meta.url),"utf8");
  const pdf=readFileSync(new URL("../app/blue-desk/reports/[id]/pdf/route.ts",import.meta.url),"utf8");
  assert.match(reader,/\.eq\("status","published"\)/);
  assert.match(reader,/getSupabasePublicConfig/);
  assert.match(pdf,/validPublicationId\(id\)/);
  assert.match(pdf,/\.eq\("status","published"\)/);
  assert.match(pdf,/entry\.pdf_path\.startsWith\(expected\)/);
  assert.match(pdf,/from\("editorial-pdfs"\)/);
});