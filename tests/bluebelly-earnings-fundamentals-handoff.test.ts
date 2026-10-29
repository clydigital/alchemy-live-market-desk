import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {officialEarningsEvents} from "../lib/forward-earnings-sources.ts";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";

const path=(name:string)=>readFileSync(new URL(name,import.meta.url),"utf8");

test("new issuer-confirmed earnings dates carry no invented release-minute or actual",()=>{
  const events=officialEarningsEvents(new Date("2026-10-29T08:00:00Z"));
  const expected=["SNDK","INTC","AMZN","PLTR","AMD","PFE"];
  for(const ticker of expected){
    const record=events.find(e=>e.affectedAssets.includes(ticker));
    assert.ok(record,ticker+" issuer date is missing");
    assert.equal(record!.status,"scheduled");
    assert.equal(record!.verificationState,"official");
    assert.ok(/^https:\/\//.test(record!.sourceUrl),ticker+" missing issuer source");
    assert.ok(record!.startAt && Number.isFinite(Date.parse(record!.startAt)),ticker+" missing qualified date");
  }
  const palantir=events.find(e=>e.affectedAssets.includes("PLTR"));
  assert.equal(palantir?.startAt?.slice(0,10),"2026-11-02");
});

test("the exact Amazon earnings brief can reach sourced long-form research instead of generic calendar prose",()=>{
  const source=path("../app/blue-desk/key-stories/page.tsx");
  const component=path("../components/blue-desk/AmazonFomcFeatures.tsx");
  assert.match(source,/selected\?\.status==="UPCOMING" && selected\.assets\.includes\("AMZN"\)/);
  assert.match(source,/<AmazonFomcFeatures kind="amazon"/);
  assert.match(component,/trailing-year operating cash reached/);
  assert.match(component,/non-operating pre-tax other income/);
});

test("the seven-company dated investor reader is visible through existing allowlisted Markets route",()=>{
  assert.equal(blueDeskHostAccess("/markets","bluebelly-desk.vercel.app"),"public");
  assert.equal(blueDeskHostAccess("/markets/earnings","bluebelly-desk.vercel.app"),"blocked");
  const markets=path("../app/blue-desk/markets/page.tsx");
  const reader=path("../components/blue-desk/EarningsFundamentals.tsx");
  assert.match(markets,/<EarningsFundamentals/);
  assert.match(reader,/researchCutoff = "29 October 2026/);
  assert.match(reader,/not automatically refreshed results/);
  for(const ticker of ["AMZN","SNDK","INTC","AMD","AAPL","PFE","PLTR"]){
    assert.match(reader,new RegExp('ticker:"'+ticker+'"'),ticker+" needs a financial investor profile");
  }
  assert.match(markets,/#coreweave-credit-watch/);
  const regime=path("../app/blue-desk/regime-watch/page.tsx");
  assert.match(regime,/coreweave-ai-financing/);
  assert.match(regime,/\#coreweave-credit-watch/);
  assert.match(regime,/not a newly accepted AI-wide Regime verdict/);
  assert.match(reader,/data-bluebelly-coreweave-watch="dated-research-not-canonical-regime"/);
  assert.match(reader,/Magnetar trimmed roughly 16\.5m shares/);
  assert.match(reader,/BlackRock added roughly 14\.7m/);
  assert.match(reader,/not an October trade tape/);
  assert.match(reader,/not a confirmed default/);
  assert.match(reader,/cash capex less cash from operations/);
  assert.match(reader,/10 November 2026, 5:00 PM ET/);
  assert.match(reader,/up to 35m Class A shares/);
  assert.match(reader,/not proof all 35m were issued/);
  assert.match(reader,/4\.2bn principal convertible-note issue/);
  assert.match(reader,/www\.sec\.gov\/Archives\/edgar/);
  assert.doesNotMatch(reader,/process\.env|service_role|supabaseAdmin|private.*research/i);
});

test("public daily and story pages link to the same evidence rather than duplicating the article",()=>{
 const daily=path("../app/blue-desk/daily-report/page.tsx");
 const key=path("../app/blue-desk/key-stories/page.tsx");
 for(const source of [daily,key]){
   assert.match(source,/\#earnings-fundamentals/);
 }
 const css=path("../components/blue-desk/EarningsFundamentals.module.css");
 assert.match(css,/@media\(max-width:800px\)/);
 assert.match(css,/@media\(max-width:480px\)/);
});
