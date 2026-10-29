import test from "node:test";
import assert from "node:assert/strict";
import {applyOfficialPressNewsIntake,OFFICIAL_PRESS_FEEDS,parseOfficialPressFeed} from "../lib/official-press-news-intake.ts";
import type {ResearchRunInput} from "../lib/research-update.ts";
import type {scrapePublicUrlWithFirecrawl} from "../lib/firecrawl.ts";

const now=new Date("2026-10-30T03:00:00.000Z");
const boc=OFFICIAL_PRESS_FEEDS.find(f=>f.host==="www.bankofcanada.ca")!;
const rbnz=OFFICIAL_PRESS_FEEDS.find(f=>f.host==="www.rbnz.govt.nz")!;
const meta=OFFICIAL_PRESS_FEEDS.find(f=>f.host==="investor.atmeta.com")!;
const broadcom=OFFICIAL_PRESS_FEEDS.find(f=>f.host==="investors.broadcom.com")!;
const bocUrl="https://www.bankofcanada.ca/2026/10/fad-press-release-2026-10-28/";
const rbnzUrl="https://www.rbnz.govt.nz/news-and-events/news/2026/10/ocr-held-at-2-75-percent";
const metaUrl="https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Announces-Pricing-of-Offering-of-Depositary-Shares-Representing-Series-A-Mandatory-Convertible-Preferred-Stock-and-Offering-of-Class-A-Common-Stock-in-Connection-with-Forward-Sale-Agreements/default.aspx";
const broadcomUrl="https://investors.broadcom.com/news-releases/news-release-details/bank-america-blackstone-citi-and-morgan-stanley-announce";
const metaTitle="Meta Announces Pricing of Offering of Class A Common Stock and Mandatory Convertible Preferred Stock";
const broadcomTitle="Bank of America, Blackstone, Citi and Morgan Stanley Announce Landmark $63 Billion Financing Structure to Enable AI Compute Capacity in Partnership with Broadcom";
const bTitle="Bank of Canada raises the policy rate by 25 basis points to 2½%";
const rTitle="OCR held at 2.75%";
const rdf='<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>Press Releases - Bank of Canada</title><dc:date>2026-10-29T21:16:38+00:00</dc:date></channel><item rdf:about="'+bocUrl+'"><title>'+bTitle+'</title><link>'+bocUrl+'</link><description>The Bank of Canada increased the overnight rate by 25 basis points.</description><dc:date>2026-10-28T09:47:20+00:00</dc:date></item></rdf:RDF>';
const xml=(title:string,url:string,published:string)=>'<rss><channel><item><title>'+title+'</title><link>'+url+'</link><pubDate>'+published+'</pubDate></item></channel></rss>';
const html=(title:string,fact:string)=>'<html><head><title>'+title+'</title></head><body><main><h1>'+title+'</h1><p>'+fact+'</p></main></body></html>';
function input():ResearchRunInput{return {runKey:"blocked-source-repair",scheduleSlot:"morning",scheduledFor:now.toISOString(),items:[],sourceChecks:[]};}
const response=(text:string,status=200,type="text/xml")=>new Response(text,{status,headers:{"content-type":type}});
const recovered=(sourceUrl:string,rawHtml:string,resolvedUrl=sourceUrl)=>({ok:true as const,sourceUrl,resolvedUrl,rawHtml,statusCode:200,warning:null});
test("Bank of Canada's genuine RSS 1.0/RDF feed preserves item-specific date, not channel date",()=>{
 const items=parseOfficialPressFeed(rdf);
 assert.equal(items.length,1);
 assert.equal(items[0].title,bTitle);
 assert.equal(items[0].url,bocUrl);
 assert.equal(items[0].publishedAt,"2026-10-28T09:47:20.000Z");
});
test("blocked BoC RDF feed and article recover via provider, but event uses independently attested decision clock",async()=>{
 const calls:string[]=[];
 const fetchImpl=(async(target:RequestInfo|URL)=>{
  const u=String(target);
  if(u===boc.feed||u===bocUrl)return response("access denied",403);
  return response("<rss><channel></channel></rss>");
 }) as typeof fetch;
 const scrapeImpl=(async(url:string)=>{
  calls.push(url);
  if(url===boc.feed)return recovered(url,rdf);
  if(url===bocUrl)return recovered(url,html(bTitle,"The Bank of Canada increased the overnight rate by 25 basis points to 2.5%, with the deposit rate at 2.45%."));
  throw Error("unexpected fallback "+url);
 }) as typeof scrapePublicUrlWithFirecrawl;
 const result=await applyOfficialPressNewsIntake(input(),{now,fetchImpl,scrapeImpl});
 const item=result.items.find(x=>x.url===bocUrl);
 assert.ok(item,"the older decision remains eligible for the seven-day public archive");
 assert.equal(item.publishedAt,"2026-10-28T13:45:00.000Z");
 assert.deepEqual(calls,[boc.feed,bocUrl]);
 assert.match(result.summary||"",/Bank of Canada press releases:checked/);
 assert.match(result.summary||"",/feed_fallback=1,article_fallback=1/);
 assert.match(item.newsSignal||"",/official bank event schedule/);
});
test("RBNZ original policy HTML blocked by host is recovered only for exact RSS item",async()=>{
 const fetchImpl=(async(target:RequestInfo|URL)=>{
  const u=String(target);
  if(u===rbnz.feed)return response(xml(rTitle,rbnzUrl,"Wed, 28 Oct 2026 00:00:00 +1300"));
  if(u===rbnzUrl)return response("blocked",403,"text/plain");
  return response("<rss><channel></channel></rss>");
 }) as typeof fetch;
 const scrapeImpl=(async (u:string)=>u===rbnzUrl?
  recovered(u,html(rTitle,"The Monetary Policy Committee decided to maintain the Official Cash Rate at 2.75% by a 4–3 vote.")):
  {ok:false as const,code:"not_configured" as const,detail:"",retryable:false}) as typeof scrapePublicUrlWithFirecrawl;
 const out=await applyOfficialPressNewsIntake(input(),{now,fetchImpl,scrapeImpl});
 const item=out.items.find(x=>x.url===rbnzUrl);
 assert.ok(item);
 assert.equal(item.publishedAt,"2026-10-28T01:00:00.000Z");
 assert.match(out.summary||"",/RBNZ official news:checked/);
});
test("Broadcom and Meta 403 feeds and 403 original releases use verified exact-page fallback",async()=>{
 const articles=[
  {feed:broadcom.feed,url:broadcomUrl,title:broadcomTitle,date:"Mon, 26 Oct 2026 16:15:00 -0400"},
  {feed:meta.feed,url:metaUrl,title:metaTitle,date:"Tue, 27 Oct 2026 01:01:00 -0400"},
 ];
 const fetchImpl=(async (target:RequestInfo|URL)=>{
  if(articles.some(x=>x.feed===String(target)||x.url===String(target)))return response("denied",403);
  return response("<rss><channel></channel></rss>");
 }) as typeof fetch;
 const scrapeImpl=(async (url:string)=>{
  const a=articles.find(x=>x.feed===url||x.url===url);
  if(!a)throw Error("wrong fallback url");
  return recovered(url,url===a.feed?xml(a.title,a.url,a.date):
    html(a.title,"The companies announced a $63 billion financing structure for large-scale AI compute capacity in 2026."));
 }) as typeof scrapePublicUrlWithFirecrawl;
 const out=await applyOfficialPressNewsIntake(input(),{now,fetchImpl,scrapeImpl});
 assert.deepEqual(out.items.map(x=>x.publisher).sort(),["Broadcom Investor Relations","Meta Investor Relations"]);
 assert.ok(out.items.every(x=>x.reviewReason?.includes("same-host press-release HTML checked")));
 assert.match(out.summary||"",/Meta investor press releases:checked/);
 assert.match(out.summary||"",/Broadcom investor news releases:checked/);
});
test("provider redirect to forged feed, wrong publisher article or mismatched headline fails closed",async()=>{
 const fetchImpl=(async (url:RequestInfo|URL)=>String(url)===broadcom.feed||String(url)===broadcomUrl?
  response("blocked",403):response("<rss><channel></channel></rss>")) as typeof fetch;
 const wrongFeed=(async (url:string)=>recovered(url,xml(broadcomTitle,broadcomUrl,"Mon, 26 Oct 2026 16:15:00 -0400"),"https://attack.invalid/rss.xml")) as typeof scrapePublicUrlWithFirecrawl;
 let out=await applyOfficialPressNewsIntake(input(),{now,fetchImpl,scrapeImpl:wrongFeed});
 assert.equal(out.items.some(x=>x.url===broadcomUrl),false);
 const wrongArticle=(async (url:string)=>url===broadcom.feed
  ? recovered(url,xml(broadcomTitle,broadcomUrl,"Mon, 26 Oct 2026 16:15:00 -0400"))
  : recovered(url,html(broadcomTitle,"This original article was replaced by an unrelated page."),"https://investors.broadcom.com/news-releases/news-release-details/other")) as typeof scrapePublicUrlWithFirecrawl;
 out=await applyOfficialPressNewsIntake(input(),{now,fetchImpl,scrapeImpl:wrongArticle});
 assert.equal(out.items.some(x=>x.url===broadcomUrl),false);
 const fakeTitle=(async (url:string)=>url===broadcom.feed
  ? recovered(url,xml(broadcomTitle,broadcomUrl,"Mon, 26 Oct 2026 16:15:00 -0400"))
  : recovered(url,html("Unrelated archive about products","An unrelated official article with no identity evidence."))) as typeof scrapePublicUrlWithFirecrawl;
 out=await applyOfficialPressNewsIntake(input(),{now,fetchImpl,scrapeImpl:fakeTitle});
 assert.equal(out.items.some(x=>x.url===broadcomUrl),false);
});
