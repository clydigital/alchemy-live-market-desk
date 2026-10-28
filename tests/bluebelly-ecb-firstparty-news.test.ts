import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {applyOfficialPressNewsIntake,OFFICIAL_PRESS_FEEDS,materiallyActionableOfficialHeadline} from "../lib/official-press-news-intake.ts";
import {projectOriginalPressNews} from "../lib/blue-desk-original-press-news.ts";
import {combineQualifiedNews} from "../lib/blue-desk-qualified-news.ts";
import type {ResearchRunInput} from "../lib/research-update.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";
const now=new Date("2026-10-29T13:00:00Z"),title="Monetary policy decisions";
const at="2026-10-29T12:15:00.000Z";
const url="https://www.ecb.europa.eu/press/pr/date/2026/html/ecb.mp261029~ab12cd3456.en.html";
const fact="The Governing Council decided today to hold the three key ECB interest rates at 2.50%, 2.65% and 2.90%.";
const html="<html><head><title>"+title+"</title></head><body><main><h1>"+title+"</h1><p>"+fact+"</p><p>This policy decision is consistent with our data-dependent assessment of inflation.</p></main></body></html>";
const rss=(u:string)=>'<rss><channel><item><title>'+title+'</title><link>'+u+'</link><pubDate>Thu, 29 Oct 2026 12:15:00 GMT</pubDate></item></channel></rss>';
const resp=(body:string,type:string)=>new Response(body,{headers:{"content-type":type}});
const feed=OFFICIAL_PRESS_FEEDS.find(x=>x.host==="www.ecb.europa.eu")!;
const input:ResearchRunInput={runKey:"ecb-source-proof",scheduleSlot:"morning",scheduledFor:now.toISOString(),items:[],sourceChecks:[]};
test("ECB feed and article admit only an original 2026 English policy decision",()=>{
 assert.equal(feed.feed,"https://www.ecb.europa.eu/rss/press.html");
 assert.equal(materiallyActionableOfficialHeadline(feed,title),true);
 assert.equal(materiallyActionableOfficialHeadline(feed,"ECB president delivers speech on monetary policy"),false);
 assert.equal(feed.path.test(new URL(url).pathname),true);
 assert.equal(feed.path.test("/press/intro/news/html/ecb.mipnews261028.en.html"),false);
});
test("ECB original policy decision enters existing gated proof with a real numerical fact",async()=>{
 const request=(async (target:RequestInfo|URL)=>{
   if(String(target)===feed.feed)return resp(rss(url),"application/rss+xml");
   if(String(target)===url)return resp(html,"text/html");
   return resp("<rss><channel></channel></rss>","text/xml");
 }) as typeof fetch;
 const got=await applyOfficialPressNewsIntake(input,{now,fetchImpl:request});
 assert.equal(got.items.length,1);
 const item=got.items[0];
 assert.equal(item.summary,fact);
 assert.equal(item.evidence?.[0].claim,title);
 assert.equal(item.evidence?.[1].claim,"OFFICIAL_FACT: "+fact);
 const db={
  id:"00000000-0000-4000-8000-000000000234",
  item_key:"official-press:"+createHash("sha256").update(url).digest("hex").slice(0,24),
  item_type:"news",status:"accepted",publisher:feed.publisher,title,summary:item.summary,url,
  published_at:at,created_at:"2026-10-29T12:30:00Z",
  source_quality:95,relevance:84,novelty:76,materiality:80,candidate_score:84,
  review_reason:item.reviewReason,evidence_links:item.evidence,
 };
 const projected=projectOriginalPressNews([db],now,5,7);
 assert.equal(projected.length,1);
 assert.equal(projected[0].sourceKind,"official");
 assert.equal(projected[0].summary,fact);
});
test("ECB forged domains, speeches and stale feeds cannot pass the original-source gate",async()=>{
 const malformed="<rss><channel>"+[
 rss("https://www.ecb.europa.eu.evil.example/press/pr/date/2026/html/ecb.mp261029~ab12cd3456.en.html").match(/<item>[\s\S]*?<\/item>/)?.[0],
 rss("https://www.ecb.europa.eu/press/pr/date/2026/html/index.en.html").match(/<item>[\s\S]*?<\/item>/)?.[0],
 ].join("")+"</channel></rss>";
 let htmlFetches=0;
 const request=(async (target:RequestInfo|URL)=>{
  if(String(target)===feed.feed)return resp(malformed,"text/xml");
  if(OFFICIAL_PRESS_FEEDS.some(f=>f.feed===String(target)))return resp("<rss><channel></channel></rss>","text/xml");
  htmlFetches++;return resp(html,"text/html");
 }) as typeof fetch;
 const got=await applyOfficialPressNewsIntake(input,{now,fetchImpl:request});
 assert.equal(htmlFetches,0);
 assert.equal(got.items.length,0);
});
test("a genuine richer official fact can replace a generic duplicate Motion but cannot displace a rich one",()=>{
 const base:NewsBriefV1={contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",
  id:"motion",headline:title,summary:title,sourceName:"European Central Bank",
  sourceUrl:url,sourceKind:"official",occurredAt:at,observedAt:at,verification:"SOURCE_VERIFIED"};
 const enriched={...base,id:"original-receipt",summary:fact};
 assert.equal(combineQualifiedNews([base],[enriched])[0].id,"original-receipt");
 assert.equal(combineQualifiedNews([{...base,summary:"The Governing Council announced a detailed sourced policy decision and confirmed the exact guidance text."}],[enriched])[0].id,"motion");
 assert.equal(combineQualifiedNews([base],[{...enriched,summary:"The original publisher issued this dated announcement. Its market-price reaction is unknown."}])[0].id,"motion");
});
