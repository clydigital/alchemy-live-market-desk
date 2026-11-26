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

test("November issuer incident recovery admits only the actual named quarter and date",async()=>{
 const now=new Date("2026-11-26T19:00:00Z");
 const sources={
  "https://investors.delltechnologies.com/news-events/press-releases/detail/1665/dell-technologies-delivers-third-quarter-fiscal-2027-financial-results":"Dell Technologies Delivers Third Quarter Fiscal 2027 Financial Results|Dell Technologies (NYSE: DELL)|fiscal 2027 third quarter",
  "https://investor.workday.com/news-and-events/press-releases/news-details/2026/Workday-Announces-Fiscal-2027-Third-Quarter-Financial-Results/default.aspx":"Workday Announces Fiscal 2027 Third Quarter Financial Results|Workday, Inc.|fiscal 2027 third quarter",
  "https://www.analog.com/en/newsroom/press-releases/2026/11-24-26-adi-reports-record-4th-qtr-and-fiscal-2026-financial-results.html":"Analog Devices Reports Record Fourth Quarter and Fiscal 2026 Financial Results|Analog Devices, Inc.|fiscal fourth quarter 2026",
 };
 const fixtures=Object.fromEntries(Object.entries(sources).map(([url,s])=>{
  const [title,company,period]=s.split("|");
  return [url,`<html><body><h1>${title}</h1><p>November 24, 2026</p><p>${company} announced financial results for the ${period}. Reported revenue, net income, operating cash flow, gross margin, earnings per share and forward guidance are described in the original dated financial results. This is a controlled test fixture, not live market evidence.</p></body></html>`];
 }));
 const result=await applyIssuerResultsPressIntake(input(),{now,fetchImpl:fetchWithFixture(fixtures)});
 assert.equal(result.items.length,3);
 const gaps=expectedIssuerReceiptGaps(result,now);
 for(const tick of ["DELL","WDAY","ADI"])assert.equal(gaps.some(g=>g.includes(":"+tick+":")),false,tick);
 const wrong={...result,items:result.items.map(i=>i.title.endsWith(" — DELL")?{...i,title:"Issuer confirms Q2 FY2027 financial results — DELL"}:i)};
 assert.ok(expectedIssuerReceiptGaps(wrong,now).some(g=>g.includes(":DELL:")));
});

test("six additional November issuers reconcile exact fiscal quarters and original dates",async()=>{
 const now=new Date("2026-11-26T19:00:00Z");
 const fixtures:Record<string,string>={};
 const releases=[
 ["https://www.hpe.com/us/en/newsroom/press-release/2026/11/hpe-reports-fiscal-2026-fourth-quarter-results.html","HPE reports fiscal 2026 fourth quarter results","HPE (NYSE: HPE)","November 23, 2026","fourth quarter of fiscal 2026"],
 ["https://www.agilent.com/about/newsroom/presrel/2026/23nov-gp26025.html","Agilent Reports Fourth-Quarter Fiscal Year 2026 Financial Results","Agilent Technologies","November 23, 2026","fourth quarter of fiscal 2026"],
 ["https://investor.hp.com/news-events/news/news-details/2026/HP-Inc--Reports-Fiscal-2026-Full-Year-and-Fourth-Quarter-Results-Announces-Dividend-Increase/default.aspx","HP Inc. Reports Fiscal 2026 Full Year and Fourth Quarter Results","HP (NYSE: HPQ)","November 24, 2026","fourth quarter of fiscal 2026"],
 ["https://investors.bestbuy.com/News--Events/news/news-details/2026/Best-Buy-Reports-Third-Quarter-Results/default.aspx","Best Buy Reports Third Quarter Results","Best Buy Co., Inc.","November 24, 2026","third quarter (Q3 FY27)"],
 ["https://news.medtronic.com/2026-11-24-Medtronic-reports-second-quarter-fiscal-2027-results-performance-reflects-consistent-execution-across-the-portfolio","Medtronic reports second quarter fiscal 2027 results","Medtronic plc","Nov. 24, 2026","second quarter of fiscal 2027"],
 ["https://www.deere.com/en-us/john-deere-news/fy26-fourth-quarter-earnings","FY26 Fourth Quarter Earnings Release","Deere &amp; Company","November 25, 2026","fourth quarter of fiscal 2026"],
 ];
 for(const [url,title,company,day,period] of releases)fixtures[url]=`<html><body><h1>${title}</h1><p>${day}</p><p>${company} announced financial results for the ${period}. Revenue, net income, earnings per share, operating cash flow, balance sheet and outlook are included in this controlled synthetic HTML fixture. It tests source identity and reporting period only, not actual financial figures.</p></body></html>`;
 const result=await applyIssuerResultsPressIntake(input(),{now,fetchImpl:fetchWithFixture(fixtures)});
 assert.equal(result.items.length,6);
 const gaps=expectedIssuerReceiptGaps(result,now);
 for(const ticker of ["HPE","A","HPQ","BBY","MDT","DE"])assert.equal(gaps.some(g=>g.includes(":"+ticker+":")),false,ticker);
 const bby=releases[3][0];
 const wrong={...fixtures,[bby]:fixtures[bby].replace("Q3 FY27","Q3 FY26")};
 const rejected=await applyIssuerResultsPressIntake(input(),{now,fetchImpl:fetchWithFixture(wrong)});
 assert.equal(rejected.items.some(i=>i.url===bby),false);
});

test("Zoom and Autodesk use the exact issuer-filed SEC exhibits, not a PDF or announcement",async()=>{
 const now=new Date("2026-11-26T19:00:00Z");
 const zoom="https://www.sec.gov/Archives/edgar/data/1585521/000158552126000170/zm-20261031ex991.htm";
 const adsk="https://www.sec.gov/Archives/edgar/data/769397/000076939726000069/q327pressrelease.htm";
 const agent="Bluebelly test desk test@example.org";
 const fixture=(title:string,company:string,date:string)=>`<html><body><h1>${title}</h1><p>${date}</p><p>${company} announced financial results for the third fiscal quarter ended October 31, 2026. Revenue, operating margin, cash flows, net income and earnings per share are present in this synthetic test document. The reporting period is fiscal year 2027 and no prices or market reaction are inferred.</p></body></html>`;
 const pages={
  [zoom]:fixture("Zoom Communications Reports Financial Results for the Third Quarter of Fiscal Year 2027","Zoom Communications, Inc.","November 23, 2026"),
  [adsk]:fixture("AUTODESK, INC. ANNOUNCES FISCAL 2027 THIRD QUARTER RESULTS","Autodesk, Inc.","NOVEMBER 24, 2026"),
 };
 const result=await applyIssuerResultsPressIntake(input(),{now,fetchImpl:fetchWithFixture(pages),secUserAgent:agent});
 assert.equal(result.items.length,2);
 const gaps=expectedIssuerReceiptGaps(result,now);
 for(const ticker of ["ZM","ADSK"])assert.equal(gaps.some(g=>g.includes(":"+ticker+":")),false,ticker);
 const wrong={...pages,[zoom]:pages[zoom].replace("November 23, 2026","November 23, 2025")};
 const rejected=await applyIssuerResultsPressIntake(input(),{now,fetchImpl:fetchWithFixture(wrong),secUserAgent:agent});
 assert.equal(rejected.items.some(i=>i.url===zoom),false);
 const later=await applyIssuerResultsPressIntake(input(),{now:new Date("2026-11-27T01:30:00Z"),fetchImpl:fetchWithFixture(pages),secUserAgent:agent});
 assert.equal(later.items.length,2,"incident recovery must survive the next scheduled slot");
});
test("issuer retrieval clocks are not eligible for timed market motion or private 24-hour leads",()=>{
 const motion=readFileSync(new URL("../lib/market-motion-ingestion.ts",import.meta.url),"utf8");
 const leads=readFileSync(new URL("../lib/bluebelly-radar-research-leads-server.ts",import.meta.url),"utf8");
 assert.ok(motion.split('item.itemKey.startsWith("issuer-press:")').length>=3);
 assert.ok(leads.includes('.not("item_key","like","issuer-press:%")'));
});
