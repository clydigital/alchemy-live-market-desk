import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  COUNTRY_IDENTITY,COMPANY_IDENTITY,countryCode,identityForSymbol,
  identityForCalendar,publicIdentitySummary,
} from "../lib/bluebelly-entity-identity.ts";

function read(path:string) {return readFileSync(new URL("../"+path,import.meta.url),"utf8");}
test("country balls cover original high-impact macro geography and pivotal diplomatic parties",()=>{
  for(const code of ["US","JP","GB","EU","DE","AU","NZ","CA","CN","IR","RU","UA"]){
    assert.ok(code in COUNTRY_IDENTITY,code);
    assert.ok(COUNTRY_IDENTITY[code as keyof typeof COUNTRY_IDENTITY].flag);
  }
  assert.equal(countryCode("Euro Area"),"EU");
  assert.equal(countryCode("Germany"),"DE");
  assert.equal(countryCode("Random unseen territory"),null);
});
test("known companies are official curated favicon mappings, not arbitrary remote asset URLs",()=>{
  for(const ticker of ["MSFT","AAPL","NVDA","GOOGL","AMZN","META","TSLA","TSM"]){
    assert.equal(identityForSymbol(ticker).kind,"company");
    assert.match(COMPANY_IDENTITY[ticker].favicon,/^https:\/\/[a-z0-9.-]+\/favicon\.ico$/i);
  }
  assert.equal(identityForSymbol("UNVERIFIED_TICKER").kind,"asset");
  assert.equal(identityForSymbol("GOLD").kind,"asset");
  assert.equal(identityForSymbol("BRENT").kind,"asset");
  assert.equal(identityForSymbol("USDJPY").kind,"asset"); // cannot pretend a cross is one country
});
test("sovereign instruments resolve only from explicit public symbol map",()=>{
  assert.deepEqual(identityForSymbol("DAX"),{kind:"country",id:"DE",label:"DAX"});
  assert.deepEqual(identityForSymbol("JGB"),{kind:"country",id:"JP",label:"JGB"});
  assert.deepEqual(identityForSymbol("US10Y"),{kind:"country",id:"US",label:"US10Y"});
});
test("calendar identity follows issuer or official source and does not infer from titles",()=>{
  assert.equal(identityForCalendar("earnings",["MSFT"],"Microsoft investor relations").id,"MSFT");
  assert.equal(identityForCalendar("economic",["USD","SPX"],"Bank of Japan").id,"JP");
  assert.equal(identityForCalendar("economic",["EUR"],"European Central Bank").id,"EU");
});
test("scope strips are bounded and deduplicated with no generated evidence relations",()=>{
 const entities=[identityForSymbol("NVDA"),identityForSymbol("NVDA"),identityForSymbol("US10Y"),identityForSymbol("BRENT")];
 assert.deepEqual(publicIdentitySummary(entities,2).map(e=>e.id),["NVDA","US"]);
});
test("global Figtree loaded once and connected to Bluebelly shell, studio and controls",()=>{
 const layout=read("app/layout.tsx"),css=read("app/globals.css"),shell=read("app/blue-desk/blue-desk.module.css");
 assert.match(layout,/import \{ Figtree \} from "next\/font\/google"/);
 assert.match(layout,/figtree\.variable/);
 assert.match(css,/--bb-font-sans/);
 assert.match(css,/button,input,select,textarea/);
 assert.match(shell,/font-family: var\(--bb-font-sans/);
});
test("shared presentation-only marks wired to both market and event contexts",()=>{
 for(const path of ["components/blue-desk/CatalystCalendar.tsx","components/blue-desk/EarningsWeekGrid.tsx",
 "app/blue-desk/markets/page.tsx","app/blue-desk/key-stories/page.tsx",
 "app/blue-desk/daily-report/page.tsx","app/blue-desk/page.tsx"]){
   assert.match(read(path),/Entity(Mark|Chip|ScopeStrip)/,path);
 }
 const kit=read("components/blue-desk/EntityIdentity.tsx");
 assert.match(kit,/onError=\{\(\)=>setError\(true\)\}/);
 assert.match(read("components/blue-desk/EntityIdentity.module.css"),/\.tone_warn\s*\{/);
 assert.doesNotMatch(kit,/service_role|story_thesis_versions|dossierId|SUPABASE_/);
});
test("Hybrid status semantics are retained as display-only not source truth",()=>{
 const hybrid=read("components/live-desk/LiveDeskUi.tsx");
 const kit=read("components/blue-desk/EntityIdentity.module.css");
 assert.match(hybrid,/"ready" \| "warn" \| "risk"/);
 for(const state of ["tone_ready","tone_warn","tone_risk"])assert.ok(kit.includes(state));
});
