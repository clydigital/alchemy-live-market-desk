import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {EARNINGS_CASES,getEarningsCase,EARNINGS_RESEARCH_CUTOFF} from "../lib/bluebelly-earnings-investor-stories.ts";
import {DATED_MARKET_DEBATES} from "../lib/bluebelly-earnings-investor-commentary.ts";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";

const source=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("seven case studies contain real business mechanics, financial bridges, decisions and original receipts",()=>{
 assert.deepEqual(EARNINGS_CASES.map(c=>c.ticker),["AMZN","INTC","SNDK","AMD","AAPL","PFE","PLTR"]);
 assert.match(EARNINGS_RESEARCH_CUTOFF,/29 October 2026/);
 for(const c of EARNINGS_CASES){
  assert.ok(c.pitch.length>=2,c.ticker+" missing business model");
  assert.ok(c.theMoney.length>=2,c.ticker+" missing explanation of earnings-to-cash");
  assert.ok(c.theCatch.length>=2,c.ticker+" missing investor countercase");
  assert.ok(c.balance.length>=2,c.ticker+" missing balance-sheet scrutiny");
  assert.ok(c.metrics.length>=6,c.ticker+" missing financial metrics");
  assert.ok(c.bridges.length>=2,c.ticker+" missing audited arithmetic/mechanism");
  assert.ok(c.calls.length>=4,c.ticker+" insufficient management questions");
  assert.ok(c.missing.length>=3,c.ticker+" failed to disclose uncertainty");
  assert.ok(c.cases.bull && c.cases.base && c.cases.bear,c.ticker+" missing scenario discipline");
  assert.ok(c.primary.length>=1 && c.primary.every(x=>/^https:\/\//.test(x.url)));
  assert.ok((DATED_MARKET_DEBATES[c.ticker]||[]).length>=1,c.ticker+" without attributed market argument");
 }
});

test("accounting exceptions and periods explicitly change the verdict",()=>{
 const amazon=getEarningsCase("AMZN")!;
 const sandisk=getEarningsCase("SNDK")!;
 const intel=getEarningsCase("INTC")!;
 const amd=getEarningsCase("AMD")!;
 const pfizer=getEarningsCase("PFE")!;
 const palantir=getEarningsCase("PLTR")!;
 assert.match(amazon.bridges.map(b=>b.formula).join(" " ),/161\.4bn.*169\.0bn.*7\.6bn/);
 assert.match(amazon.theMoney.join(" "),/non-operating pre-tax income/);
 assert.match(intel.bridges.map(b=>b.formula).join(" "),/5\.8bn.*5\.5bn.*0\.3bn/);
 assert.match(intel.theMoney.join(" "),/42\.0% non-GAAP/);
 assert.match(sandisk.bridges.map(b=>b.formula).join(" "),/7\.126bn.*7\.083bn.*5\.035bn/);
 assert.match(sandisk.theCatch.join(" "),/10\.3–10\.8bn/);
 assert.match(amd.theMoney.join(" "),/None vested or became exercisable/);
 assert.match(pfizer.bridges.map(b=>b.formula).join(" "),/51%/);
 assert.match(palantir.theMoney.join(" "),/not the same as quarterly revenue or cash collected/);
 assert.equal(getEarningsCase("private-source"),null);
 assert.equal(getEarningsCase("META"),null);
});

test("the deep reader stays in bounded public Markets route and preserves dated Amazon bookmark",()=>{
 const markets=source("../app/blue-desk/markets/page.tsx");
 const stories=source("../app/blue-desk/key-stories/page.tsx");
 const article=source("../components/blue-desk/EarningsInvestorDeepDive.tsx");
 assert.equal(blueDeskHostAccess("/markets","bluebelly-desk.vercel.app"),"public");
 assert.equal(blueDeskHostAccess("/markets/earnings","bluebelly-desk.vercel.app"),"blocked");
 assert.equal(blueDeskHostAccess("/owner/research","bluebelly-desk.vercel.app"),"private");
 assert.match(markets,/query\.view==="earnings"\?getEarningsCase/);
 assert.match(markets,/<EarningsInvestorDeepDive ticker=\{detail\.ticker\}/);
 assert.match(stories,/briefId==="earnings:mev_146cecdc376b7290256b1a81"/);
 assert.match(stories,/data-earnings-bookmark="immutable-dated-preview"/);
 assert.match(stories,/data-bluebelly-earnings-preview="full-dated-financial-investigation"/);
 assert.match(article,/data-bluebelly-financial-article=\{item\.ticker\}/);
 assert.match(article,/what this debate cannot prove|What this debate cannot prove/);
 assert.match(article,/Bond|bond market/);
});

test("reader labels secondary discussion and prevents manufactured beats or current quotes",()=>{
 const article=source("../components/blue-desk/EarningsInvestorDeepDive.tsx");
 const css=source("../components/blue-desk/EarningsInvestorDeepDive.module.css");
 assert.match(article,/not a live stock recommendation/);
 assert.match(article,/do not infer|Do not infer/);
 assert.match(article,/DATED_MARKET_DEBATES\[item\.ticker\]/);
 assert.match(article,/Matched|matched|comparable maturity/);
 assert.match(css,/@media\(max-width:950px\)/);
 assert.match(css,/@media\(max-width:680px\)/);
 for(const [ticker,reads] of Object.entries(DATED_MARKET_DEBATES)){
  assert.ok(EARNINGS_CASES.some(e=>e.ticker===ticker));
  for(const read of reads){
   assert.ok(read.date.length>4&&read.limitation.length>25);
   assert.match(read.source,/^https:\/\//);
  }
 }
});
