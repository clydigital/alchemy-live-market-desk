import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {officialEarningsEvents} from "../lib/forward-earnings-sources.ts";
import {blueDeskHostAccess,blueDeskPresentationTarget,blueDeskPublicHref}
 from "../lib/blue-desk-host.ts";

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("November earnings preview has explicit public routing but no expanded owner/API access",()=>{
 const host="bluebelly-desk.vercel.app";
 assert.equal(blueDeskHostAccess("/earnings-week",host),"public");
 assert.equal(blueDeskHostAccess("/blue-desk/earnings-week",host),"public");
 assert.equal(blueDeskPresentationTarget("/earnings-week",host),"/blue-desk/earnings-week");
 assert.equal(blueDeskPublicHref("/blue-desk/earnings-week",host),"/earnings-week");
 for(const path of ["/earnings-week/private","/api/owner/earnings-week",
   "/earnings-week/../../owner/research","/blue-desk/earnings-week/archive"]){
  assert.equal(blueDeskHostAccess(path,host),"blocked",path);
 }
});

test("Weekly earnings story covers requested sectors and labels the pre-release evidence basis",()=>{
 const page=read("../app/blue-desk/earnings-week/page.tsx");
 const tickers=["AAPL","PLTR","PFE","ETN","AMD","SMCI","ANET","ALAB","NVTS",
  "UBER","QCOM","ARM","COHR","MRNA","OKLO","VST"];
 for(const ticker of tickers)assert.match(page,new RegExp('ticker:"'+ticker+'"'));
 assert.match(page,/PRE-EARNINGS EDITION/);
 assert.match(page,/Earnings Whispers/);
 assert.match(page,/issuer date to confirm/i);
 assert.match(page,/gross bookings/i);
 assert.match(page,/free cash flow/i);
 assert.match(page,/Robotaxi/i);
 assert.match(page,/preliminary/i);
 assert.match(page,/no unverified whisper figures/i);
 assert.match(page,/owner|investor|report/i);
 assert.ok(!page.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE"));
});

test("Earnings research has source links and remains a single grouped feature",()=>{
 const page=read("../app/blue-desk/earnings-week/page.tsx");
 const sourceCount=(page.match(/source:"https:\/\//g)||[]).length;
 assert.ok(sourceCount>=16);
 assert.match(page,/https:\/\/www\.earningswhispers\.com\/calweek\/20261102/);
 assert.match(page,/Supermicro-Provides-First-Quarter-of-Fiscal-Year-2027-Preliminary-Business-Update/);
 for(const path of ["../app/blue-desk/calendar/page.tsx",
   "../app/blue-desk/daily-report/page.tsx"]){
  assert.match(read(path),/blue-desk\/earnings-week/);
 }
 assert.match(read("../lib/bluebelly-public-research-library.ts"),/earnings-week-nov2/);
});

test("Six November company IR notices feed live earnings Calendar and Daily Report input",()=>{
 const now=new Date("2026-11-02T04:30:00Z");
 const events=officialEarningsEvents(now);
 for(const ticker of ["ETN","SMCI","NVTS","UBER","QCOM","MRNA"]){
  const event=events.find(e=>e.affectedAssets.includes(ticker));
  assert.ok(event,ticker+" should be issuer-admitted");
  assert.equal(event.verificationState,"official");
  assert.equal(event.timePrecision,"exact");
  assert.ok(event.sourceUrl.startsWith("https://"));
  assert.match(event.expectedStage||"",/release|call|webcast|results|report/i);
 }
 assert.equal(events.find(e=>e.affectedAssets.includes("AAPL")),undefined,
  "Earnings Whispers schedule is not silently promoted to an issuer-confirmed event");
});
