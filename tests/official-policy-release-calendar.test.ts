import test from "node:test";
import assert from "node:assert/strict";
import {policyScheduleForOriginalRelease} from "../lib/official-policy-release-calendar.ts";
import {applyOfficialPressNewsIntake,OFFICIAL_PRESS_FEEDS} from "../lib/official-press-news-intake.ts";
import type {ResearchRunInput} from "../lib/research-update.ts";

const at=(time:string)=>new Date(time);
const url={
 boc:"https://www.bankofcanada.ca/2026/12/fad-press-release-2026-12-09/",
 rbnz:"https://www.rbnz.govt.nz/news-and-events/news/2026/12/ocr-held-at-2-75-percent",
 rba:"https://www.rba.gov.au/media-releases/2026/mr-26-33.html",
};
function attest(host:string,uri:string,rssPublishedAt:string,now="2026-12-10T00:00:00Z"){
 return policyScheduleForOriginalRelease({host,url:uri,rssPublishedAt,now:at(now)});
}
test("bank decision calendars attest future dates, DST and fall-back clocks without a per-URL lookup",()=>{
 assert.equal(attest("www.bankofcanada.ca",url.boc,"2026-12-09T14:47:00Z")?.releaseAt,
   "2026-12-09T14:45:00.000Z");
 assert.equal(attest("www.bankofcanada.ca",
   "https://www.bankofcanada.ca/2026/10/fad-press-release-2026-10-28/",
   "2026-10-28T09:47:00Z","2026-11-01T00:00:00Z")?.releaseAt,
   "2026-10-28T13:45:00.000Z");
 assert.equal(attest("www.rbnz.govt.nz",url.rbnz,"2026-12-08T11:00:00Z")?.releaseAt,
   "2026-12-09T01:00:00.000Z");
 assert.equal(attest("www.rba.gov.au",url.rba,"2026-12-08T03:30:00Z")?.releaseAt,
   "2026-12-08T03:30:00.000Z");
 assert.equal(attest("www.rba.gov.au",
   "https://www.rba.gov.au/media-releases/2026/mr-26-25.html",
   "2026-09-29T04:30:00Z","2026-10-01T00:00:00Z")?.releaseAt,
   "2026-09-29T04:30:00.000Z");
});
test("publisher identity, date, future schedule, off-calendar changes and untrusted RSS fail closed",()=>{
 assert.equal(attest("www.bankofcanada.ca",
   "https://www.bankofcanada.ca/2026/12/fad-press-release-2026-12-08/",
   "2026-12-09T14:47:00Z"),null);
 assert.equal(attest("www.rbnz.govt.nz",
   "https://www.rbnz.govt.nz.evil.example/news-and-events/news/2026/12/ocr-held",
   "2026-12-08T11:00:00Z"),null);
 assert.equal(attest("www.rbnz.govt.nz",url.rbnz,"2026-12-05T11:00:00Z"),null);
 assert.equal(attest("www.rba.gov.au",url.rba,"2026-12-09T03:30:00Z"),null);
 assert.equal(attest("www.bankofcanada.ca",
   "https://www.bankofcanada.ca/2027/01/fad-press-release-2027-01-28/",
   "2027-01-28T14:47:00Z","2027-01-29T00:00:00Z"),null);
 assert.equal(attest("www.bankofcanada.ca",url.boc,"2026-12-09T14:47:00Z",
   "2026-12-09T14:00:00Z"),null);
});
function rss(entries:readonly {title:string;url:string;date:string}[]){
 return "<rss version=\"2.0\"><channel>"+entries.map(x=>
   "<item><title>"+x.title+"</title><link>"+x.url+"</link><pubDate>"+x.date+"</pubDate></item>").join("")+
   "</channel></rss>";
}
const bocTitle="Bank of Canada holds overnight rate at 2.75%";
const rbnzTitle="OCR held at 2.75%";
const rbaTitle="Monetary Policy Decision Statement";
const releaseHtml=(title:string,extra="")=>
 "<html><head><title>"+title+"</title></head><body><h1>"+title+"</h1>"+
 extra+"</body></html>";
const now=at("2026-12-09T17:00:00Z");
const fixture:ResearchRunInput={
 runKey:"scheduled-policy-next-release",scheduleSlot:"evening",
 scheduledFor:now.toISOString(),items:[],sourceChecks:[],summary:"replay",
};
test("next BoC RBNZ RBA scheduled decisions enter the existing intake only with original HTML",async()=>{
 const boc=OFFICIAL_PRESS_FEEDS.find(f=>f.host==="www.bankofcanada.ca")!;
 const rbnz=OFFICIAL_PRESS_FEEDS.find(f=>f.host==="www.rbnz.govt.nz")!;
 const rba=OFFICIAL_PRESS_FEEDS.find(f=>f.host==="www.rba.gov.au")!;
 const items=[
  {feed:boc,title:bocTitle,url:url.boc,date:"Wed, 09 Dec 2026 14:47:00 GMT"},
  {feed:rbnz,title:rbnzTitle,url:url.rbnz,date:"Tue, 08 Dec 2026 11:00:00 GMT"},
  {feed:rba,title:rbaTitle,url:url.rba,date:"Tue, 08 Dec 2026 03:30:00 GMT"},
 ];
 const body=new Map([
  [url.boc,releaseHtml(bocTitle,"<p>The Bank of Canada maintained its overnight rate at 2.75 per cent.</p>")],
  [url.rbnz,releaseHtml(rbnzTitle,"<p>The Monetary Policy Committee held the OCR at 2.75%.</p>")],
  [url.rba,releaseHtml(rbaTitle,
    '<time datetime="2026-12-08T03:30:00.000Z"></time>'+
    "<p>Media Release 2026-33.</p>"+
    "<p>At its meeting today, the Board decided to leave the cash rate target unchanged at 4.85 per cent.</p>")],
 ]);
 const requested:string[]=[];
 const fetchImpl=(async (target:RequestInfo | URL)=>{
  const uri=String(target);requested.push(uri);
  const feed=items.find(x=>x.feed.feed===uri);
  if(feed)return new Response(rss([{title:feed.title,url:feed.url,date:feed.date}]),
     {status:200,headers:{"content-type":"application/rss+xml"}});
  if(OFFICIAL_PRESS_FEEDS.some(x=>x.feed===uri))
    return new Response(rss([]),{status:200,headers:{"content-type":"application/rss+xml"}});
  if(body.has(uri))return new Response(body.get(uri),{status:200,headers:{"content-type":"text/html"}});
  return new Response("Not found",{status:404});
 }) as typeof fetch;
 const result=await applyOfficialPressNewsIntake(fixture,{now,fetchImpl});
 assert.equal(result.items.length,3);
 const rows=result.items.map(x=>[x.publisher,x.publishedAt]);
 assert.deepEqual(rows,[
  ["Bank of Canada","2026-12-09T14:45:00.000Z"],
  ["Reserve Bank of New Zealand","2026-12-09T01:00:00.000Z"],
  ["Reserve Bank of Australia","2026-12-08T03:30:00.000Z"],
 ]);
 assert.ok(result.items.every(x=>x.newsSignal?.includes("Scheduled decision minute")));
 assert.ok(result.items.every(x=>x.newsSignal?.includes("does not prove the exact moment")));
 assert.ok(result.items.every(x=>x.recommendedAction==="collect_evidence"));
 assert.equal(requested.length,OFFICIAL_PRESS_FEEDS.length+3,
   "No additional producer, policy-calendar HTTP call or external probe");
});
test("source calendar alone never admits forged original content",async()=>{
 const bad=OFFICIAL_PRESS_FEEDS.find(f=>f.host==="www.bankofcanada.ca")!;
 const fetchImpl=(async (target:RequestInfo | URL)=>{
  const uri=String(target);
  if(uri===bad.feed)
    return new Response(rss([{title:bocTitle,url:url.boc,date:"Wed, 09 Dec 2026 14:47:00 GMT"}]),
      {headers:{"content-type":"application/rss+xml"}});
  if(OFFICIAL_PRESS_FEEDS.some(f=>f.feed===uri))
    return new Response(rss([]),{headers:{"content-type":"application/rss+xml"}});
  return new Response(releaseHtml("Unrelated investor discussion"),
    {headers:{"content-type":"text/html"}});
 }) as typeof fetch;
 const result=await applyOfficialPressNewsIntake(fixture,{now,fetchImpl});
 assert.deepEqual(result.items,[]);
 assert.match(result.summary||"",/title_mismatch=1/);
});
