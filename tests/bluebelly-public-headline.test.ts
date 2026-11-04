import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {publicReadingHeadline} from "../lib/bluebelly-public-headline.ts";

const jolts="Job Openings and Labor Turnover Survey for September 2026 (September 2026): Job openings 7.5M. Original government actual; expectations and market reactions are not established by this record.";
const oil="Crude oil inputs also fell in the Middle East as the closure of the strait significantly limited the export of refined products. Increased attacks on Russian oil infrastructure during the ongoing conflict between Russia and Ukraine reduced refinery crude oil inputs in Russia by 0.6 million b/d in 2Q26 and an additional 0.8 million b/d in 3Q26.";
const rba="Released high-impact central bank event scheduled for 2026-11-03 at 14:30 AEDT. Actual: RBA cash rate target 4.85% (+25bp, raised) · Consensus: not loaded · Desk expectation: not recorded · Previous: 4.60%. Desk question: Is the rate hike priced in?";
const pce="BEA reported September headline PCE inflation of 3.6% year-on-year and 0.5% month-on-month; core PCE was 3.1% year-on-year and 0.3% month-on-month. Nominal consumer spending rose 0.5%, but real spending was essentially flat; personal income grew 0.2%.";
const amd="Data Centre supplied $4.205bn of the group's $4.131bn year-on-year revenue growth (~102%), while free cash flow declined. A strong AI order book is not yet equivalent to steady cash conversion.";

test("verified source notice becomes a concise, factual, period-explicit title",()=>{
 assert.equal(publicReadingHeadline(jolts),"JOLTS: 7.5m job openings in September 2026");
 assert.equal(publicReadingHeadline(oil),"Middle East crude inputs fall as strait closure limits refined-product exports");
 assert.equal(publicReadingHeadline(rba),"RBA raises cash rate 25bp to 4.85%");
 assert.equal(publicReadingHeadline(pce),"September PCE inflation at 3.6% y/y; real spending flat");
 assert.equal(publicReadingHeadline(amd),"Data Centre drives ~102% of revenue growth as free cash flow falls");
});

test("generic ECB document uses attached original figures, never a guessed rate",()=>{
 const source="European Central Bank";
 const summary="The interest rates on the deposit facility, the main refinancing operations and the marginal lending facility will remain unchanged at 2.50%, 2.65% and 2.90% respectively.";
 assert.equal(publicReadingHeadline("Monetary policy decisions",summary,source),"ECB holds deposit rate at 2.50%");
 assert.equal(publicReadingHeadline("Monetary policy decisions","Rates have been discussed",source),"Monetary policy decisions");
 assert.equal(publicReadingHeadline("Monetary policy decisions",summary,"Other source"),"Monetary policy decisions");
});

test("unknown, conditional and incomplete sources are unchanged and retain qualifications",()=>{
 const nuanced="Exports rose at the start of the month. However, the statistical agency revised the earlier period down and officials said the effect remains uncertain.";
 assert.equal(publicReadingHeadline(nuanced),nuanced);
 assert.equal(publicReadingHeadline("Job Openings and Labor Turnover Survey for September 2026"),"Job Openings and Labor Turnover Survey for September 2026");
 assert.equal(publicReadingHeadline("RBA could raise its rate to 4.85%"),"RBA could raise its rate to 4.85%");
 assert.equal(publicReadingHeadline("Rate cut expected, not confirmed"),"Rate cut expected, not confirmed");
 assert.equal(publicReadingHeadline("Monetary policy decisions","No independent actual","ECB"),"Monetary policy decisions");
 assert.equal(publicReadingHeadline(""),"");
});

test("headline rewriting is read-only and integrated consistently into the public reader",()=>{
 const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
 const source=read("lib/bluebelly-public-headline.ts");
 const today=read("components/blue-desk/ProgressiveTodayReader.tsx");
 const wire=read("components/blue-desk/BluebellyNewsWire.tsx");
 const stories=read("app/blue-desk/key-stories/page.tsx");
 const recap=read("components/blue-desk/ShortNewsRecap.tsx");
 for(const reader of [today,wire,stories,recap])assert.match(reader,/publicReadingHeadline\(/);
 assert.match(today,/Original source wording:/);
 assert.match(wire,/SourceOnlyConsequence news=\{card\.item\}/);
 assert.match(stories,/topic\.updates\[0\]\.summary/);
 assert.match(recap,/rawNews:news/);
 assert.match(source,/return original;/);
 assert.doesNotMatch(source,/fetch\(|createSupabaseAdminClient|generateContent\(|callLLM\(|insert\(|upsert\(|update\(/);
});

test("actual live headings pair only with their own verified source detail",()=>{
 const joltsTitle="Job Openings and Labor Turnover Survey for September 2026 — September 2026 official result";
 const oilTitle="Global refinery inputs fell sharply in the second quarter of 2026 before modest recovery";
 const rbaTitle="RBA monetary-policy decision and Statement on Monetary Policy · Released";
 const secTitle="SEC Issues Exemptive Relief from Treasury Clearing Requirements for Certain Inter-Affiliate and Non-U.S. Repo Transactions";
 assert.equal(publicReadingHeadline(joltsTitle,jolts),"JOLTS: 7.5m job openings in September 2026");
 assert.equal(publicReadingHeadline(oilTitle,oil),"Middle East crude inputs fall as strait closure limits refined-product exports");
 assert.equal(publicReadingHeadline(rbaTitle,rba),"RBA raises cash rate 25bp to 4.85%");
 assert.equal(publicReadingHeadline(secTitle),"SEC grants Treasury-clearing relief for some repo trades");
 assert.equal(publicReadingHeadline(joltsTitle,"Job openings 8M in October 2026"),joltsTitle);
 assert.equal(publicReadingHeadline(oilTitle,"Unclear refinery trend"),oilTitle);
 assert.equal(publicReadingHeadline(rbaTitle,"RBA rate decision expected, not released"),rbaTitle);
 assert.equal(publicReadingHeadline("US PCE inflation reaches 3.6% as real spending stalls",pce),"US PCE inflation reaches 3.6% as real spending stalls");
});
