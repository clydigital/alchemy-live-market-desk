import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {applyOfficialPressNewsIntake,OFFICIAL_PRESS_FEEDS,materiallyActionableOfficialHeadline} from "../lib/official-press-news-intake.ts";
import {projectOriginalPressNews} from "../lib/blue-desk-original-press-news.ts";
import type {ResearchRunInput} from "../lib/research-update.ts";

const source=OFFICIAL_PRESS_FEEDS.find(x=>x.host==="www.eia.gov");
const title="EIA increases global oil production forecast after the opening of the Strait of Hormuz";
const url="https://www.eia.gov/pressroom/releases/press590.php";
const date="Tue, 07 Jul 2026 16:00:00 GMT";
const now=new Date("2026-07-08T12:00:00Z");
const response=(body:string,type:string,status=200)=>new Response(body,{status,headers:{"content-type":type}});
const fixture=(urlText:string)=>'<rss><channel><item><title>'+title+'</title><link>'+urlText+'</link><pubDate>'+date+'</pubDate></item></channel></rss>';
test("EIA uses a genuine official RSS URL and a narrow same-host press article contract",()=>{
 assert.equal(source?.feed,"https://www.eia.gov/rss/press_rss.xml");
 assert.equal(source?.path.test("/pressroom/releases/press590.php"),true);
 assert.equal(source?.path.test("/todayinenergy/prices.php"),false);
 assert.equal(materiallyActionableOfficialHeadline(source!,title),true);
 assert.equal(materiallyActionableOfficialHeadline(source!,"EIA announces newsroom events"),false);
});
test("original EIA press release enters existing scheduled intake, never a market-price claim",async()=>{
 const input:ResearchRunInput={runKey:"eia-rss-proof",scheduleSlot:"morning",scheduledFor:now.toISOString(),items:[],sourceChecks:[],summary:""};
 const fetchImpl=(async (target:RequestInfo|URL)=>{
  if(String(target)===source!.feed)return response(fixture(url),"application/rss+xml");
  if(String(target)===url)return response("<html><head><title>"+title+"</title></head><body><h1>"+title+"</h1><p>Original issuer statement.</p></body></html>","text/html");
  return response("<rss><channel></channel></rss>","text/xml");
 }) as typeof fetch;
 const result=await applyOfficialPressNewsIntake(input,{now,fetchImpl});
 assert.equal(result.items.length,1);
 const entry=result.items[0];
 assert.equal(entry.publisher,"U.S. Energy Information Administration");
 assert.equal(entry.url,url);
 assert.equal(entry.evidence?.[0].claim,title);
 assert.doesNotMatch(entry.newsSignal||"",/oil prices rose because|stocks rallied/);
 const projected=projectOriginalPressNews([{
  id:"00000000-0000-4000-8000-000000000001",
  item_key:"official-press:"+createHash("sha256").update(url).digest("hex").slice(0,24),
  item_type:"news",status:"accepted",publisher:entry.publisher,title,url,
  published_at:"2026-07-07T16:00:00.000Z",created_at:"2026-07-07T17:00:00.000Z",
  source_quality:95,relevance:84,novelty:76,materiality:80,candidate_score:84,
  review_reason:entry.reviewReason,
  evidence_links:[{url,claim:title,publisher:entry.publisher,publishedAt:"2026-07-07T16:00:00.000Z"}],
 }],now,4,7);
 assert.equal(projected.length,1);
 assert.equal(projected[0].sourceKind,"official");
 assert.equal(projected[0].verification,"SOURCE_VERIFIED");
});
test("forged EIA domains, unofficial pages and stale publication dates fail closed",async()=>{
 const input:ResearchRunInput={runKey:"eia-proof-negative",scheduleSlot:"morning",scheduledFor:now.toISOString(),items:[],sourceChecks:[]};
 const xml='<rss><channel>'+[
  "https://www.eia.gov.evil.test/pressroom/releases/press590.php",
  "https://www.eia.gov/pressroom/releases.php",
  "https://www.eia.gov/pressroom/releases/press590.php?fake=1",
 ].map(u=>'<item><title>'+title+'</title><link>'+u+'</link><pubDate>'+date+'</pubDate></item>').join("")+
 '<item><title>'+title+'</title><link>'+url+'</link><pubDate>Mon, 01 Jun 2026 12:00:00 GMT</pubDate></item></channel></rss>';
 let fetchedArticle=false;
 const fetchImpl=(async (target:RequestInfo|URL)=>{
  if(String(target)===source!.feed)return response(xml,"text/xml");
  if(String(target)===url)fetchedArticle=true;
  return response("<rss><channel></channel></rss>","text/xml");
 }) as typeof fetch;
 const result=await applyOfficialPressNewsIntake(input,{now,fetchImpl});
 assert.equal(fetchedArticle,false);
 assert.equal(result.items.length,0);
});
