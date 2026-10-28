import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {applyOfficialPressNewsIntake,OFFICIAL_PRESS_FEEDS} from "../lib/official-press-news-intake.ts";
import type {ResearchRunInput} from "../lib/research-update.ts";

const file=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("newsroom provides distinct dated approved decision explainers without falsely inflating verified news",()=>{
 const page=file("app/blue-desk/newsroom/page.tsx");
 const component=file("components/blue-desk/NewsroomBriefableEvents.tsx");
 const wire=file("components/blue-desk/BluebellyNewsWire.tsx");
 assert.match(page,/buildPresenterCalendar\(macro,earnings,now\)/);
 assert.match(page,/decisionTopics\(news,calendar,now\)/);
 assert.match(page,/<NewsroomBriefableEvents topics=\{briefable\} readerHref=\{readerHref\}/);
 assert.match(page,/<BluebellyNewsWire news=\{news\}/);
 assert.match(wire,/\{children\}/);
 assert.match(page,/getOriginalPressNews\(now,18,7\)/);
 assert.match(component,/data-newsroom-briefable="separate-from-news-wire"/);
 assert.match(component,/t\.status==="UPCOMING"\|\|t\.status==="FEATURE"\|\|t\.href\.startsWith\("\?brief="\)/);
 assert.match(component,/UPCOMING · OUTCOME UNKNOWN/);
 // A pending result teaches the financial mechanism; its next test is
 // separately action-oriented, not the same question repeated twice.
 assert.match(component,/item.status==="UPCOMING"\?item.mechanism:item.fact/);
 assert.match(component,/<strong>Next check:<\/strong> \{item.test\}/);
 assert.match(component,/ISSUER-VERIFIED RESULTS · COMPARISON UNVERIFIED/);
 assert.match(component,/href=\{readerHref\+item\.href\}/);
 assert.match(component,/not additional accepted news-wire records/);
 assert.match(component,/EditorialStoryArt/);
 assert.match(wire,/source-verified report/);
 assert.doesNotMatch(component,/createSupabaseAdminClient|fetch\(|generateContent|write.*Story/i);
});

test("official-source diagnostics distinguish no qualifying headlines from title/read failures",async()=>{
 const time=new Date("2026-10-29T02:00:00.000Z");
 const fed=OFFICIAL_PRESS_FEEDS.find(x=>x.host==="www.federalreserve.gov")!;
 const title="Federal Reserve Board issues statement on monetary policy";
 const url="https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm";
 const wrong="https://different-source.example/newsevents/pressreleases/monetary20261028a.htm";
 const old="https://www.federalreserve.gov/newsevents/pressreleases/monetary20251028a.htm";
 const generic="https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028b.htm";
 const other="https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028c.htm";
 const item=(t:string,u:string,d:string)=>"<item><title>"+t+"</title><link>"+u+"</link><pubDate>"+d+"</pubDate></item>";
 const body="<rss><channel>"+[
   item(title,url,"Wed, 28 Oct 2026 18:00:00 GMT"),
   item(title,wrong,"Wed, 28 Oct 2026 18:00:00 GMT"),
   item(title,old,"Tue, 28 Oct 2025 18:00:00 GMT"),
   item("Reserve Board calendar details",generic,"Wed, 28 Oct 2026 18:00:00 GMT"),
   item(title,other,"Wed, 28 Oct 2026 18:00:00 GMT"),
  ].join("")+"</channel></rss>";
 const response=(x:string,type="text/xml")=>new Response(x,{status:200,headers:{"content-type":type}});
 const fetchImpl=(async (arg:RequestInfo|URL)=>{
   const u=String(arg);
   if(u===fed.feed)return response(body);
   if(OFFICIAL_PRESS_FEEDS.some(f=>f.feed===u))return response("<rss><channel></channel></rss>");
   if(u===url)return response("<html><head><title>"+title+"</title></head><body><h1>"+title+"</h1></body></html>","text/html");
   if(u===other)return response("<html><head><title>Unrelated old press</title></head><body><h1>Unrelated press bulletin</h1></body></html>","text/html");
   throw new Error("Unexpected fetch "+u);
 }) as typeof fetch;
 const input:ResearchRunInput={runKey:"diagnostic-test",scheduleSlot:"morning",scheduledFor:time.toISOString(),items:[],sourceChecks:[]};
 const actual=await applyOfficialPressNewsIntake(input,{now:time,fetchImpl});
 assert.equal(actual.items.length,1);
 assert.match(actual.summary||"",/Federal Reserve monetary-policy press releases:checked,linked=2,read=1/);
 assert.match(actual.summary||"",/feed_entries=5/);
 assert.match(actual.summary||"",/wrong_url=1/);
 assert.match(actual.summary||"",/stale_or_bad_clock=1/);
 assert.match(actual.summary||"",/nonmaterial=1/);
 assert.match(actual.summary||"",/title_mismatch=1/);
 assert.match(actual.summary||"",/html_failed=0/);
});
