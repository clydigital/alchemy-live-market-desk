import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {applyIssuerResultsPressIntake} from "../lib/issuer-results-press-intake.ts";
import {expectedIssuerReceiptGaps} from "../lib/scheduled-issuer-receipt-coverage.ts";
import type {ResearchRunInput} from "../lib/research-update.ts";

const now=new Date("2026-10-30T01:30:00Z"); // 09:30 MYT after real US session
const urls={
 amazon:"https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-Third-Quarter-Results/default.aspx",
 intel:"https://www.intc.com/news-events/press-releases/detail/1786/intel-reports-third-quarter-2026-financial-results",
 sandisk:"https://investor.sandisk.com/news-releases/news-release-details/sandisk-reports-fiscal-first-quarter-2027-financial-results",
 microsoft:"https://www.microsoft.com/en-us/investor/earnings/fy-2027-q1/press-release-webcast",
};
function input():ResearchRunInput{
 return {runKey:"test-existing-scheduled",scheduleSlot:"morning",
  scheduledFor:"2026-10-30T01:30:00Z",sourceChecks:[],items:[]};
}
const html:Record<string,string>={
 [urls.amazon]:`<html><head><title>Amazon.com Announces Third Quarter Results</title></head>
 <body><h1>Amazon.com Announces Third Quarter Results</h1><p>October 29, 2026</p>
 <p>Amazon.com, Inc. (NASDAQ: AMZN) today announced financial results for its third quarter ended September 30, 2026.</p>
 <p>Net sales increased 12% to $201.9 billion and operating income was $28.1 billion.</p></body></html>`,
 [urls.intel]:`<html><body><h1>Intel Reports Third-Quarter 2026 Financial Results</h1>
 <p>October 29, 2026. Intel Corporation today reported third-quarter 2026 financial results.</p>
 <p>Third-quarter revenue was $16.5 billion and the company reported non-GAAP earnings per share. The original financial results include third-quarter results and quarter-specific operating income, guidance and management comments about demand for server products.</p></body></html>`,
 [urls.sandisk]:`<html><body><h1>Sandisk Reports Fiscal First Quarter 2027 Financial Results</h1>
 <p>October 29, 2026</p><p>Sandisk Corporation reported its fiscal first quarter financial results.</p>
 <p>Revenue was $11,031 million, increasing 23% quarter over quarter. Reported GAAP operating income was $8,780 million with demand from datacenter customers and the cash conversion analysis detailed in the original source.</p></body></html>`,
 [urls.microsoft]:`<html><body><h2>Microsoft Announces First Quarter Results</h2>
 <p>October 28, 2026 - Microsoft Corp. today announced results for the quarter ended September 30, 2026.</p>
 <p>Revenue was $92.3 billion for the first quarter of fiscal year 2027. Reported operating income was $45.9 billion with a detailed reconciliation of the company’s GAAP and non-GAAP results and original cash flow statements.</p></body></html>`,
};
function fetchWithFixture(source:Record<string,string>):typeof fetch{
 return (async (target:RequestInfo|URL)=>{
  const u=String(target);
  if(source[u])return new Response(source[u],{status:200,
    headers:{"content-type":"text/html"}});
  return new Response("not found",{status:404,headers:{"content-type":"text/plain"}});
 }) as typeof fetch;
}
test("existing 09:30 MYT research cycle acquires AMZN, INTC, SNDK, MSFT original sources",async()=>{
 const a=await applyIssuerResultsPressIntake(input(),{now,fetchImpl:fetchWithFixture(html)});
 assert.deepEqual(new Set(a.items.map(i=>i.publisher)),new Set([
  "Amazon Investor Relations","Intel Investor Relations",
  "Sandisk Investor Relations","Microsoft Investor Relations",
 ]));
 assert.ok(a.items.every(i=>i.itemKey==="issuer-press:"+createHash("sha256").update(i.url).digest("hex").slice(0,24)));
 assert.ok(a.items.every(i=>i.publishedAt===now.toISOString()));
 assert.ok(a.items.every(i=>i.reviewReason?.startsWith("Issuer-original result:")));
 assert.ok(a.items.every(i=>i.evidence?.every(e=>e.url===i.url&&e.publishedAt===now.toISOString())));
 const missing=expectedIssuerReceiptGaps(a,now);
 for(const tick of ["AMZN","INTC","SNDK","MSFT"]){
  assert.equal(missing.some(m=>m.includes(":"+tick+":")),false,tick);
 }
 assert.ok(missing.some(m=>m.includes(":GOOGL:")),"Alphabet remains open until first-party result exists");
});
test("a genuine issuer listing discovers new original result even after bounded October direct recovery",async()=>{
 const day=new Date("2026-10-31T01:30:00Z");
 const amazonListing="https://ir.aboutamazon.com/overview/";
 const source={...html,[amazonListing]:`<section><a href="/news-release/news-release-details/2026/Amazon-com-Announces-Third-Quarter-Results/default.aspx">Third quarter results</a></section>`};
 const result=await applyIssuerResultsPressIntake(input(),{now:day,fetchImpl:fetchWithFixture(source)});
 assert.ok(result.items.some(i=>i.url===urls.amazon));
});
test("forged, preview, wrong-period, redirected and other-host results cannot be promoted",async()=>{
 const bad=[
  html[urls.amazon].replace("October 29, 2026","October 29, 2025"),
  html[urls.amazon].replaceAll("Third Quarter Results","Fourth Quarter Results").replaceAll("third quarter ended","fourth quarter ended"),
  html[urls.amazon].replace("financial results","conference call to discuss future results").replace("Net sales","Market outlook"),
  html[urls.amazon].replace("Net sales","Sales").replace("operating income","cost"),
 ];
 for(const article of bad){
  const result=await applyIssuerResultsPressIntake(input(),{now,
   fetchImpl:fetchWithFixture({[urls.amazon]:article})});
  assert.equal(result.items.some(i=>i.url===urls.amazon),false);
  assert.ok(expectedIssuerReceiptGaps(result,now).some(x=>x.includes(":AMZN:")));
 }
 const outside=await applyIssuerResultsPressIntake(input(),{now,fetchImpl:fetchWithFixture({
  "https://ir.aboutamazon.com/overview/":`<a href="https://ir.aboutamazon.com.evil.example/news-release/news-release-details/2026/Amazon-com-Announces-Third-Quarter-Results/default.aspx">result</a>`,
 })});
 assert.equal(outside.items.length,0);
});
test("future calls do not get results admitted from stale October pages",async()=>{
 const later=await applyIssuerResultsPressIntake(input(),{
  now:new Date("2026-11-11T01:00:00Z"),fetchImpl:fetchWithFixture(html),
 });
 assert.equal(later.items.length,0);
});
test("scheduled research pipeline includes original IR retrieval before generic fallback and gap assessment",()=>{
 const source=readFileSync(new URL("../lib/firecrawl-scheduled-research.ts",import.meta.url),"utf8");
 const issuer=source.indexOf("await applyIssuerResultsPressIntake(");
 const sec=source.indexOf("await applyMaterialSecProspectusIntake(");
 const gaps=source.indexOf("expectedIssuerReceiptGaps(recovered,now)");
 assert.ok(issuer>0&&sec>issuer&&gaps>sec);
});
