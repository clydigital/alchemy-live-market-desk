import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {applyOfficialPressNewsIntake,OFFICIAL_PRESS_FEEDS} from "../lib/official-press-news-intake.ts";
import {projectOriginalPressNews} from "../lib/blue-desk-original-press-news.ts";
import type {ResearchRunInput} from "../lib/research-update.ts";

const ecb=OFFICIAL_PRESS_FEEDS.find(f=>f.host==="www.ecb.europa.eu")!;
const eia=OFFICIAL_PRESS_FEEDS.find(f=>f.feed==="https://www.eia.gov/rss/todayinenergy.xml")!;
const eiaPress=OFFICIAL_PRESS_FEEDS.find(f=>f.feed==="https://www.eia.gov/rss/press_rss.xml")!;
const now=new Date("2026-10-30T03:00:00Z");
const ecbTitle="Monetary policy decisions";
const originalEcb="https://www.ecb.europa.eu//press/pr/date/2026/html/ecb.mp261029~9a493adf17.en.html";
const canonicalEcb="https://www.ecb.europa.eu/press/pr/date/2026/html/ecb.mp261029~9a493adf17.en.html";
const eiaTitle="LNG imports make up increasing share of Colombia's natural gas supply";
const eiaUrl="https://www.eia.gov/todayinenergy/detail.php?id=68364";
function rss(t:string,u:string,at:string){return "<rss><channel><item><title>"+t+"</title><link>"+u+"</link><pubDate>"+at+"</pubDate></item></channel></rss>";}
function html(t:string,fact:string){return "<html><head><title>"+t+"</title></head><body><main><h1>"+t+"</h1><p>"+fact+"</p></main></body></html>";}
function response(body:string,type="text/xml"){return new Response(body,{status:200,headers:{"content-type":type}});}
function input():ResearchRunInput{return {runKey:"real-world-feeds",scheduleSlot:"morning",scheduledFor:now.toISOString(),items:[],sourceChecks:[]};}

test("ECB RSS double slash canonicalises to a permitted original English policy page",async()=>{
 const called:string[]=[];
 const fetcher=(async(req:RequestInfo|URL)=>{
  const u=String(req);called.push(u);
  if(u===ecb.feed)return response(rss(ecbTitle,originalEcb,"Thu, 29 Oct 2026 14:15:00 +0100"));
  if(u===canonicalEcb)return response(html(ecbTitle,"The Governing Council decided to maintain the three key ECB interest rates at 2.50%, 2.65% and 2.90%."),"text/html");
  return response("<rss><channel></channel></rss>");
 }) as typeof fetch;
 const got=await applyOfficialPressNewsIntake(input(),{now,fetchImpl:fetcher});
 assert.equal(got.items.length,1);
 assert.equal(got.items[0].url,canonicalEcb);
 assert.equal(called.includes(originalEcb),false);
 assert.match(got.items[0].summary,/2.50%/);
});
test("EIA relative official press release path resolves, but does not infer a market response",async()=>{
 const at=new Date("2026-07-08T12:00:00Z");
 const title="EIA increases global oil production forecast after the opening of the Strait of Hormuz";
 const url="https://www.eia.gov/pressroom/releases/press590.php";
 const fetched:string[]=[];
 const fetcher=(async(req:RequestInfo|URL)=>{
  const u=String(req);fetched.push(u);
  if(u===eiaPress.feed)return response(rss(title,"/pressroom/releases/press590.php","Tue, 07 Jul 2026 16:00:00 GMT"));
  if(u===url)return response(html(title,"The U.S. Energy Information Administration increased the global oil production forecast for 2026."),"text/html");
  return response("<rss><channel></channel></rss>");
 }) as typeof fetch;
 const got=await applyOfficialPressNewsIntake(input(),{now:at,fetchImpl:fetcher});
 assert.deepEqual(got.items.map(x=>x.url),[url]);
 assert.equal(fetched.includes("/pressroom/releases/press590.php"),false);
 assert.match(got.items[0].newsSignal||"",/market impact has not been established/);
});
test("source-dated EIA analysis is attributed as analysis, never press-release news proof",async()=>{
 const published="2026-10-29T14:00:00.000Z",fact="Colombia is importing more liquefied natural gas as domestic production continues to fall and local gas supply contracts.";
 const fetcher=(async(req:RequestInfo|URL)=>{
  const u=String(req);
  if(u===eia.feed)return response(rss(eiaTitle,eiaUrl,"Thu, 29 Oct 2026 14:00:00 GMT"));
  if(u===eiaUrl)return response(html(eiaTitle,fact),"text/html");
  return response("<rss><channel></channel></rss>");
 }) as typeof fetch;
 const got=await applyOfficialPressNewsIntake(input(),{now,fetchImpl:fetcher});
 const entry=got.items.find(x=>x.url===eiaUrl)!;
 assert.ok(entry);
 assert.match(entry.newsSignal||"",/First-party EIA analysis/);
 const row={id:"00000000-0000-4000-8000-000000000981",
  item_key:"official-press:"+createHash("sha256").update(eiaUrl).digest("hex").slice(0,24),
  item_type:"news",status:"accepted",publisher:entry.publisher,title:eiaTitle,
  summary:entry.summary,url:eiaUrl,published_at:published,created_at:"2026-10-29T14:30:00Z",
  source_quality:95,relevance:84,materiality:80,novelty:76,candidate_score:84,
  review_reason:entry.reviewReason,evidence_links:entry.evidence};
 const displayed=projectOriginalPressNews([row],now,5,7);
 assert.equal(displayed.length,1);
 assert.equal(displayed[0].sourceName,"EIA Today in Energy (official analysis)");
 assert.match(displayed[0].summary,/Colombia is importing/);
 assert.equal(projectOriginalPressNews([{...row,review_reason:"Original official RSS publication clock and directly linked same-host press-release HTML checked. Headline describes the announcement only, not its financial effect."}],now,5,7).length,0);
});
test("lookalike hosts, arbitrary queries and protocol-relative EIA links fail closed",async()=>{
 const called:string[]=[];
 const malicious=["https://www.ecb.europa.eu.evil.test//press/pr/date/2026/html/ecb.mp261029~9a493adf17.en.html",
  "//www.eia.gov/pressroom/releases/press590.php",
  "https://www.eia.gov/todayinenergy/detail.php?id=68364&redirect=evil"];
 const fetcher=(async(req:RequestInfo|URL)=>{
  const u=String(req);called.push(u);
  if(u===ecb.feed)return response(rss(ecbTitle,malicious[0],"Thu, 29 Oct 2026 14:15:00 +0100"));
  if(u===eiaPress.feed)return response(rss("EIA increases global oil production forecast",malicious[1],"Thu, 29 Oct 2026 14:00:00 GMT"));
  if(u===eia.feed)return response(rss(eiaTitle,malicious[2],"Thu, 29 Oct 2026 14:00:00 GMT"));
  if(OFFICIAL_PRESS_FEEDS.some(f=>f.feed===u))return response("<rss><channel></channel></rss>");
  throw Error("Unapproved article URL fetched: "+u);
 }) as typeof fetch;
 assert.equal((await applyOfficialPressNewsIntake(input(),{now,fetchImpl:fetcher})).items.length,0);
 assert.ok(malicious.every(u=>!called.includes(u)));
});
