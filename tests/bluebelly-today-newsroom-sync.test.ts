import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {publicNewsroomEditorials,selectTodayNewsroomItems} from "../lib/bluebelly-public-newsroom-feed.ts";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";
import type {NewsroomEditorialItem} from "../lib/bluebelly-newsroom-editorial.ts";
const file=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");
const host="bluebelly-desk.vercel.app";
const now=new Date("2026-11-02T05:30:00Z");
const item=(id:string,date:string,summary="Verified editorial summary"):NewsroomEditorialItem=>({
 id,headline:"Market implications of "+id,summary,occurredAt:date,
 sourceName:"Issuer source",sourceUrl:"https://example.org/reports/"+id,
 readerHref:"/newsroom/week-ahead#"+id,topics:["policy"],verificationLabel:"DATED EDITORIAL",
 why:"Investor context",nextTest:"What evidence could change the conclusion",kind:"reported",
});
test("Today and Newsroom share the same public editorial projection, including Meet Kevin",()=>{
 const editorials=publicNewsroomEditorials([],now,host);
 const ids=editorials.map(e=>e.id);
 for(const name of ["nov2-week-ahead:midterms","nov2-week-ahead:creator-midterms",
   "nov2-week-ahead:ism","nov2-week-ahead:labour","nov2-week-ahead:earnings"]){
  assert.ok(ids.includes(name),name);
 }
 const today=selectTodayNewsroomItems([],[],editorials,now,host,5);
 assert.equal(today.length,5);
 for(const name of ["nov2-week-ahead:midterms","nov2-week-ahead:creator-midterms",
    "nov2-week-ahead:ism","nov2-week-ahead:labour","nov2-week-ahead:earnings"]){
  assert.ok(today.some(x=>x.id==="editorial:"+name),name);
 }
 assert.ok(today.some(x=>x.label.includes("ATTRIBUTED CREATOR OPINION")));
 assert.ok(today.every(x=>x.readerHref.startsWith("/newsroom/week-ahead")));
});
test("New public newsroom editorial text appears in Today on next render, without homepage edits",()=>{
 const original=item("new-decision","2026-11-02","Initial review");
 let today=selectTodayNewsroomItems([],[],[original],now,host,5);
 assert.equal(today[0].summary,"Initial review");
 const updated={...original,summary:"Updated investment thesis after review"};
 today=selectTodayNewsroomItems([],[],[updated],now,host,5);
 assert.equal(today[0].summary,"Updated investment thesis after review");
 assert.equal(today[0].readerHref,original.readerHref);
});
test("Today never promotes future, stale, unverified or external publication links",()=>{
 const entries=[item("current","2026-11-02"),
  item("future","2026-11-05"),
  item("old","2026-10-15"),
  {...item("outside","2026-11-02"),readerHref:"https://untrusted.example/path"},
  {...item("protocol-relative","2026-11-02"),readerHref:"//external.example/path"},
  {...item("bad-source","2026-11-02"),sourceUrl:"javascript:alert(1)"}];
 const today=selectTodayNewsroomItems([],[],entries,now,host,5);
 assert.deepEqual(today.map(x=>x.id),["editorial:current"]);
 assert.deepEqual(selectTodayNewsroomItems([],[],entries,new Date("invalid"),host,5),[]);
 assert.equal(blueDeskHostAccess("/owner/research",host),"private"); // Owner access is authenticated.
 assert.equal(blueDeskHostAccess("/my-reports",host),"private"); // Owner authentication is still required.
});
test("Front page and Newsroom use the exact same editorial projector and Today is dynamic",()=>{
 const today=file("../app/blue-desk/page.tsx");
 const newsroom=file("../app/blue-desk/newsroom/page.tsx");
 const component=file("../components/blue-desk/TodayNewsroomFeed.tsx");
 assert.match(today,/publicNewsroomEditorials\(recentNews,now,host\)/);
 assert.match(newsroom,/publicNewsroomEditorials\(news,now,host\)/);
 assert.match(today,/selectTodayNewsroomItems\(/);
 assert.match(today,/TodayNewsroomFeed items=\{newsroomToday\}/);
 assert.match(today,/export const dynamic = "force-dynamic"/);
 assert.match(component,/data-today-newsroom-sync="shared-public-newsroom-feed"/);
 assert.match(component,/source date/);
 assert.doesNotMatch(component,/REVIEWED AS VERIFIED/);
});
