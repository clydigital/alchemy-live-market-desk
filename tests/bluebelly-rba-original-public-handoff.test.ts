import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {OFFICIAL_PRESS_FEEDS,applyOfficialPressNewsIntake,materiallyActionableOfficialHeadline} from "../lib/official-press-news-intake.ts";
import {projectOriginalPressNews} from "../lib/blue-desk-original-press-news.ts";
import {reconcileReviewedBankReaders} from "../lib/bluebelly-reviewed-bank-handoff.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";
import type {ResearchRunInput} from "../lib/research-update.ts";

const at=new Date("2026-11-03T09:00:00.000Z");
const release="https://www.rba.gov.au/media-releases/2026/mr-26-30.html";
const clock="2026-11-03T03:30:00.000Z";
const name="Statement by the Monetary Policy Board: Monetary Policy Decision";
const feed=OFFICIAL_PRESS_FEEDS.find(f=>f.host==="www.rba.gov.au")!;
const input:ResearchRunInput={runKey:"rba-original",scheduleSlot:"morning",
 scheduledFor:at.toISOString(),sourceChecks:[],items:[],summary:"Scheduled acquisition"};
const rss=(url=release,title=name,date="2026-11-03T14:30+11:00")=>
 '<rss version="2.0"><channel><item><title>'+title+'</title><link>'+url+
 '</link><pubDate>'+date+'</pubDate></item></channel></rss>';
const original=(body="At its meeting today, the Board decided to increase the cash rate target by 25 basis points to 4.85 per cent.")=>
 '<!doctype html><html><head><title>'+name+'</title></head><body>'+
 '<h1>'+name+'</h1><time datetime="'+clock+'">3 November 2026</time>'+
 '<p>Media Release Number 2026-30</p><p>'+body+'</p>'+
 '<p>Today’s policy decision was by majority: six members voted to increase the cash rate target by 25 basis points to 4.85 per cent; three members voted to leave the cash rate target unchanged at 4.60 per cent.</p></body></html>';
const res=(body:string,type:string)=>new Response(body,{status:200,headers:{"content-type":type}});
function mock(originalHtml=original(),feedXml=rss()){
 const requested:string[]=[];
 const fetchImpl=(async (req:RequestInfo|URL)=>{
  const url=String(req);requested.push(url);
  if(url===feed.feed)return res(feedXml,"application/rss+xml");
  if(url===release)return res(originalHtml,"text/html");
  if(OFFICIAL_PRESS_FEEDS.some(f=>url===f.feed))return res('<rss version="2.0"><channel></channel></rss>',"application/rss+xml");
  return new Response("Unavailable",{status:404});
 }) as typeof fetch;
 return {fetchImpl,requested};
}
test("official RBA generic RSS title requires direct body plus exact original source time",async()=>{
 assert.ok(feed);
 assert.match(feed.feed,/rba\.gov\.au\/rss\/rss-cb-media-releases\.xml/);
 assert.equal(materiallyActionableOfficialHeadline(feed,name),true);
 assert.equal(materiallyActionableOfficialHeadline(feed,"Reserve Bank of Australia announces a media event"),false);
 const {fetchImpl,requested}=mock();
 const result=await applyOfficialPressNewsIntake(input,{now:at,fetchImpl});
 assert.equal(result.items.length,1);
 const item=result.items[0];
 assert.equal(item.url,release);
 assert.equal(item.publishedAt,clock);
 assert.equal(item.publisher,"Reserve Bank of Australia");
 assert.match(item.summary,/4\.85%/);
 assert.match(item.summary,/4\.60%/);
 assert.equal(item.evidence?.[0]?.claim,name);
 assert.equal(item.evidence?.[1]?.claim?.startsWith("OFFICIAL_FACT:"),true);
 assert.ok(requested.includes(release),"must read original RBA HTML, not trust only RSS");
 assert.match(item.newsSignal||"",/No asset reaction is established/);
 const stored={
  ...item,id:"c3d10730-521c-4480-94c0-504034754692",
  item_key:item.itemKey,item_type:"news",status:"accepted",
  created_at:"2026-11-03T08:00:00.000Z",
  published_at:item.publishedAt,source_quality:item.sourceQuality,
  candidate_score:86,review_reason:item.reviewReason,evidence_links:item.evidence,
 };
 const projection=projectOriginalPressNews([stored],at,8,2);
 assert.equal(projection.length,1);
 assert.equal(projection[0].sourceKind,"official");
 assert.equal(projection[0].sourceUrl,release);
 assert.match(projection[0].summary,/4\.85%/);
 assert.match(projection[0].summary,/six members voted/i);
 assert.doesNotMatch(projection[0].summary,/original publisher issued this dated announcement/i);
 assert.equal(reconcileReviewedBankReaders(projection,at)[0].status,"ORIGINAL_RECEIPT_VISIBLE");
});
test("RBA spoofed domain, missing action, wrong clock and future policy title fail closed",async()=>{
 for(const variant of [
  {xml:rss("https://www.rba.gov.au.evil.invalid/media-releases/2026/mr-26-30.html"),html:original()},
  {xml:rss(),html:original("At its meeting today, the Board scheduled future discussions.")},
  {xml:rss(release,name,"2026-11-06T14:30+11:00"),html:original()},
  {xml:rss(release,"Statement by the Monetary Policy Board: Public Consultation"),html:original()},
  {xml:rss("https://www.rba.gov.au/media-releases/2026/mr-26-31.html"),html:original()},
 ]) {
  const {fetchImpl}=mock(variant.html,variant.xml);
  const found=await applyOfficialPressNewsIntake(input,{now:at,fetchImpl});
  assert.equal(found.items.length,0,"unattested or non-decision RBA release must not enter accepted intake");
 }
});
test("approved public bank article remains indexed even when automatic source admission is missing",()=>{
 const before=reconcileReviewedBankReaders([],at);
 assert.equal(before.length,1);
 assert.equal(before[0].bank.id,"rba-2026-11-03");
 assert.equal(before[0].status,"REVIEWED_READER_NO_FEED_RECEIPT");
 const news:NewsBriefV1={
  contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",
  id:"c3d10730-521c-4480-94c0-504034754692",
  headline:name,summary:"Cash rate increased by 25 basis points.",
  sourceName:"Reserve Bank of Australia",sourceUrl:release,sourceKind:"official",
  occurredAt:clock,observedAt:"2026-11-03T08:00:00.000Z",verification:"SOURCE_VERIFIED"
 };
 assert.equal(reconcileReviewedBankReaders([news],at)[0].status,"ORIGINAL_RECEIPT_VISIBLE");
 assert.equal(reconcileReviewedBankReaders([{...news,sourceUrl:"https://rba.gov.au.evil.invalid/release"}],at)[0].status,"REVIEWED_READER_NO_FEED_RECEIPT");
 assert.equal(reconcileReviewedBankReaders([{...news,verification:"UNVERIFIED" as never}],at)[0].status,"REVIEWED_READER_NO_FEED_RECEIPT");
 assert.equal(reconcileReviewedBankReaders([],new Date("2026-11-06T09:00:00Z")).length,0);
});
