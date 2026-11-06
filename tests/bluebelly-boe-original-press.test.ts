import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {applyOfficialPressNewsIntake, OFFICIAL_PRESS_FEEDS, materiallyActionableOfficialHeadline} from "../lib/official-press-news-intake.ts";
import {projectOriginalPressNews} from "../lib/blue-desk-original-press-news.ts";
import {buildMarketMotionCandidates} from "../lib/market-motion-ingestion.ts";
import type {ResearchRunInput} from "../lib/research-update.ts";

const now=new Date("2026-11-05T16:00:00.000Z");
const originalUrl="https://www.bankofengland.co.uk/monetary-policy-summary-and-minutes/2026/november-2026";
const title="Bank rate increased to 4% - November 2026 Monetary Policy Summary and Minutes";
const publishedAt="2026-11-05T12:00:00.000Z";
const boe=OFFICIAL_PRESS_FEEDS.find(x=>x.host==="www.bankofengland.co.uk")!;
const originalHtml='<html><head><title>'+title+'</title></head><body><h1>'+title+
  '</h1><p>The Monetary Policy Committee voted by a majority of 8–1 to increase Bank Rate by 0.25 percentage points, to 4%.</p></body></html>';
const response=(body:string,type:string)=>new Response(body,{headers:{"content-type":type}});
const rss=(rows:readonly {title:string,url:string,stamp:string}[])=>
  '<rss version="2.0"><channel>'+rows.map(x=>'<item><title>'+x.title+
  '</title><link>'+x.url+'</link><pubDate>'+x.stamp+'</pubDate></item>').join("")+'</channel></rss>';
const input=():ResearchRunInput=>({runKey:"boe-original-source-test",scheduleSlot:"morning",
  scheduledFor:now.toISOString(),sourceChecks:[],items:[],summary:""});

test("BoE policy feed requires exact same-host decision path and outcome-specific heading",()=>{
  assert.equal(boe.feed,"https://www.bankofengland.co.uk/rss/news");
  assert.equal(boe.path.test(new URL(originalUrl).pathname),true);
  assert.equal(boe.path.test("/news/2026/november/bank-rate-increased"),false);
  assert.equal(boe.path.test("/monetary-policy-report/2026/november-2026"),false);
  assert.equal(boe.path.test("/monetary-policy-summary-and-minutes/2026/november-2026/preview"),false);
  assert.equal(materiallyActionableOfficialHeadline(boe,title),true);
  assert.equal(materiallyActionableOfficialHeadline(boe,"Monetary Policy Summary and Minutes - November 2026"),false);
  assert.equal(materiallyActionableOfficialHeadline(boe,"Bank Rate decision scheduled for November 2026"),false);
});

test("original BoE RSS and independently fetched HTML become verified official news, with no invented market reaction",async()=>{
  const seen:string[]=[];
  const fetchImpl=(async (target:RequestInfo|URL)=>{
    const u=String(target);seen.push(u);
    if(u===boe.feed)return response(rss([{title,url:originalUrl,stamp:"Thu, 05 Nov 2026 12:00:00 GMT"}]),"application/rss+xml");
    if(u===originalUrl)return response(originalHtml,"text/html");
    return response(rss([]),"application/rss+xml");
  }) as typeof fetch;
  const result=await applyOfficialPressNewsIntake(input(),{now,fetchImpl});
  assert.deepEqual(result.items.map(x=>x.url),[originalUrl]);
  assert.ok(seen.includes(boe.feed)&&seen.includes(originalUrl));
  const entry=result.items[0];
  assert.equal(entry.publisher,"Bank of England");
  assert.equal(entry.publishedAt,publishedAt);
  assert.equal(entry.itemKey,"official-press:"+createHash("sha256").update(originalUrl).digest("hex").slice(0,24));
  assert.equal(entry.sourceQuality,95);
  assert.equal(entry.evidence?.[0].url,originalUrl);
  const motions=buildMarketMotionCandidates([{...entry,candidateScore:84,evidence:entry.evidence||[]}],[],{now});
  assert.equal(motions.length,1);
  assert.equal(motions[0].sourceKind,"official");
  assert.equal(motions[0].verificationState,"VERIFIED");
  assert.equal(motions[0].marketReaction,null);
  const row={
    id:"00000000-0000-4000-8000-000000001106",item_key:entry.itemKey,item_type:"news",status:"accepted",
    publisher:entry.publisher,title:entry.title,url:originalUrl,summary:entry.summary,
    published_at:publishedAt,created_at:"2026-11-05T12:12:00.000Z",
    source_quality:entry.sourceQuality,relevance:entry.relevance,novelty:entry.novelty,
    materiality:entry.materiality,candidate_score:84,review_reason:entry.reviewReason,evidence_links:entry.evidence,
  };
  const projected=projectOriginalPressNews([row],now,8,7);
  assert.equal(projected.length,1);
  assert.equal(projected[0].sourceKind,"official");
  assert.equal(projected[0].verification,"SOURCE_VERIFIED");
  assert.equal(projected[0].sourceUrl,originalUrl);
  assert.equal(projected[0].occurredAt,publishedAt);
});

test("BoE forged publisher, calendar previews, and stale policy records never trigger original HTML fetch",async()=>{
  let pageReads=0;
  const fake="https://www.bankofengland.co.uk.evil.invalid/monetary-policy-summary-and-minutes/2026/november-2026";
  const fetchImpl=(async (target:RequestInfo|URL)=>{
    const u=String(target);
    if(u===boe.feed)return response(rss([
      {title,url:fake,stamp:"Thu, 05 Nov 2026 12:00:00 GMT"},
      {title:"Monetary Policy Summary and Minutes - November 2026",url:originalUrl,stamp:"Thu, 05 Nov 2026 12:00:00 GMT"},
      {title,url:originalUrl+"/preview",stamp:"Thu, 05 Nov 2026 12:00:00 GMT"},
      {title,url:originalUrl,stamp:"Thu, 22 Oct 2026 12:00:00 GMT"},
      {title,url:originalUrl,stamp:"Thu, 12 Nov 2026 12:00:00 GMT"},
    ]),"application/rss+xml");
    if(OFFICIAL_PRESS_FEEDS.some(f=>f.feed===u))return response(rss([]),"text/xml");
    pageReads++;return response(originalHtml,"text/html");
  }) as typeof fetch;
  const got=await applyOfficialPressNewsIntake(input(),{now,fetchImpl});
  assert.deepEqual(got.items,[]);
  assert.equal(pageReads,0);
});

test("BoE source fails closed on an unrelated original HTML page",async()=>{
  const fetchImpl=(async (target:RequestInfo|URL)=>{
    const u=String(target);
    if(u===boe.feed)return response(rss([{title,url:originalUrl,stamp:"Thu, 05 Nov 2026 12:00:00 GMT"}]),"text/xml");
    if(u===originalUrl)return response("<html><title>Unrelated statement</title><h1>Unrelated statement</h1></html>","text/html");
    return response(rss([]),"text/xml");
  }) as typeof fetch;
  const result=await applyOfficialPressNewsIntake(input(),{now,fetchImpl});
  assert.deepEqual(result.items,[]);
  assert.match(result.summary||"",/Bank of England monetary-policy decisions:no_new_items/);
});
