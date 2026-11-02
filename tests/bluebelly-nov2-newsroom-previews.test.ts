import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {blueDeskHostAccess,blueDeskPresentationTarget,blueDeskPublicHref}
 from "../lib/blue-desk-host.ts";
import {weekAheadNewsroomEditorial,NEWSROOM_NOVEMBER_SOURCES}
 from "../lib/bluebelly-week-ahead-newsroom.ts";

const source=(p:string)=>readFileSync(new URL(p,import.meta.url),"utf8");
const host="bluebelly-desk.vercel.app";
test("Source-dated Newsroom preview route is exact-public, owner/API remains blocked",()=>{
 assert.equal(blueDeskHostAccess("/newsroom/week-ahead",host),"public");
 assert.equal(blueDeskHostAccess("/blue-desk/newsroom/week-ahead",host),"public");
 assert.equal(blueDeskPresentationTarget("/newsroom/week-ahead",host),
  "/blue-desk/newsroom/week-ahead");
 assert.equal(blueDeskPublicHref("/blue-desk/newsroom/week-ahead",host),
  "/newsroom/week-ahead");
 for(const path of ["/newsroom/week-ahead/private",
  "/blue-desk/newsroom/week-ahead/owner",
  "/api/newsroom/week-ahead", "/newsroom/week-ahead/../../owner/editorial"]){
  assert.equal(blueDeskHostAccess(path,host),"blocked",path);
 }
});
test("Midterms, creator-sourced opinion, ISM, jobs and earnings form five separately classified cards",()=>{
 const href="/newsroom/week-ahead";
 const items=weekAheadNewsroomEditorial(new Date("2026-11-02T04:00:00Z"),href);
 assert.deepEqual(items.map(i=>i.id),["nov2-week-ahead:midterms",
  "nov2-week-ahead:creator-midterms","nov2-week-ahead:ism",
  "nov2-week-ahead:labour","nov2-week-ahead:earnings"]);
 for(const item of items){
  assert.match(item.readerHref,/^\/newsroom\/week-ahead#/);
  assert.equal(item.occurredAt,"2026-11-02");
  if(item.id.endsWith(":creator-midterms"))assert.match(item.verificationLabel,/CREATOR OPINION.*NOT VERIFIED OUTCOME/);
  else assert.match(item.verificationLabel,/PRE-EVENT.*NOT RESULTS/);
  assert.ok(item.sourceUrl.startsWith("https://"));
  assert.ok(item.nextTest.length>75);
 }
 const expired=weekAheadNewsroomEditorial(new Date("2026-11-10T00:01:00Z"),href);
 assert.equal(expired.length,0,"Frozen previews do not masquerade as breaking news forever");
 assert.equal(weekAheadNewsroomEditorial(new Date("2026-11-01T12:00:00Z"),href).length,0);
});
test("Original sources and 2-6 November release times are explicit",()=>{
 const p=source("../app/blue-desk/newsroom/week-ahead/page.tsx");
 const editorial=source("../app/blue-desk/newsroom/page.tsx");
 const daily=source("../app/blue-desk/daily-report/page.tsx");
 assert.match(p,/FROZEN PRE-EVENT EDITION/);
 assert.match(p,/33 regular contests and two special elections/);
 assert.match(p,/435 House seats/);
 assert.match(p,/54\.5/);
 assert.match(p,/77\.9/);
 assert.match(p,/54\.9/);
 assert.match(p,/74\.0/);
 assert.match(p,/29,000/);
 assert.match(p,/4\.2%/);
 assert.match(p,/08:30 ET/);
 assert.match(p,/actual, comparable consensus, previous, revisions/);
 assert.match(p,/time-matched/);
 assert.match(p,/The strongest objection/);
 assert.match(p,/blue-desk\/earnings-week/);
 assert.match(p,/Meet Kevin revisited the midterms in two videos/);
 assert.match(p,/7KqjagCM80I/);
 assert.match(p,/H1xVMX__KNc/);
 assert.match(p,/bilateral bargaining is not Morgan Stanley/);
 assert.match(p,/Goldman Sachs Asset Management/);
 assert.match(p,/J.P. Morgan Private Bank/);
 assert.match(p,/State Street/);
 assert.match(p,/future result/);
 assert.doesNotMatch(p,/\$9 trillion of GDP will/);
 assert.match(editorial,/publicNewsroomEditorials/);
 assert.match(source("../lib/bluebelly-public-newsroom-feed.ts"),/weekAheadNewsroomEditorial/);
 assert.match(daily,/blue-desk\/newsroom\/week-ahead/);
 for(const url of Object.values(NEWSROOM_NOVEMBER_SOURCES))assert.ok(url.startsWith("https://"));
 assert.doesNotMatch(p,/election results are now known/i);
});
