import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(p:string)=>readFileSync(new URL(p,import.meta.url),"utf8");
const key=read("../app/blue-desk/key-stories/page.tsx");
const feature=read("../components/blue-desk/MidtermRallyFeature.tsx");
const midtermPath=read("../components/blue-desk/MidtermHistoricalPath.tsx");
const midtermPolicy=read("../components/blue-desk/MidtermPolicyScenarios.tsx");
const news=read("../app/blue-desk/newsroom/week-ahead/page.tsx");

test("midterm feature is an explicit, finite public Key Stories article",()=>{
 assert.match(key,/feature==="midterms-seasonality-2026"/);
 assert.match(key,/data-key-story="midterms-2026-frozen-editorial"/);
 assert.match(key,/MidtermRallyFeature host=\{host\}/);
 assert.match(key,/data-feature="midterms-seasonality-2026"/);
 assert.match(key,/Midterm rally: verified or vulnerable/);
 assert.match(news,/id="midterm-asset-views"/);
 assert.match(news,/key-stories"\)\+"\?feature=midterms-seasonality-2026"/);
});

test("return windows, original creators and counterexamples are correctly identified",()=>{
 assert.match(feature,/data-bluebelly-midterm-key-story="frozen-source-labelled-2026-11-02"/);
 assert.match(feature,/19\/19/);
 assert.match(feature,/15\.4%/);
 assert.match(feature,/13\.89%/);
 assert.match(feature,/six months/);
 assert.match(feature,/twelve months/);
 assert.match(feature,/2022/);
 for(const id of ["QT82i3qsHjs","vYAAtuF8_Cs"])assert.match(feature,new RegExp(id));
 for(const ticker of ["SPY","QQQ","SMH","SOXX","XLE","VGK","PLTR","TSLA"])assert.match(feature,new RegExp(ticker));
 assert.match(feature,/Both|both/);
 assert.match(feature,/remain unconfirmed/);
 assert.match(feature,/3 November/);
 assert.match(feature,/6 November/);
 assert.match(feature,/10 November/);
 assert.doesNotMatch(feature,/Election result confirmed|2026 election results are/);
 assert.doesNotMatch(feature,/app\.notion\.com\/p\//);
 assert.match(feature,/Historical return figures describe specified samples/);
});

test("feature retains authenticated data separation and does not create new APIs",()=>{
 assert.doesNotMatch(feature,/from ["']@\/lib\/(?:blue-desk-.*-server|supabase|private)/);
 assert.doesNotMatch(feature,/fetch\(|process\.env|cookies\(/);
 assert.match(feature,/not a canonical market-regime verdict/);
});

test("midterm historical path is finite, data-labelled and chart-limited to one month",()=>{
 assert.match(feature,/MidtermHistoricalPath/);
 assert.match(midtermPath,/data-midterm-path-chart="first-month-only"/);
 assert.match(midtermPath,/const PATH=\[\{label:"Election"/);
 assert.match(midtermPath,/WEEKLY\.map/);
 assert.match(midtermPath,/MONTHLY:Window\[\]/);
 for(const number of ["1.11","0.02","0.70","1.70","3.52","7.70","14.14","15.11"]){
  assert.match(midtermPath,new RegExp(number.replace(".","\\.")));
 }
 assert.match(midtermPath,/months six through nine/);
 assert.match(midtermPath,/17\/19 at months ten and eleven/);
 assert.match(midtermPath,/Financial Modeling Prep/);
 assert.match(midtermPath,/excluding dividends|exclude dividends/);
});

test("part two connects election control, historical returns and five sectors without partisan forecasts",()=>{
 assert.match(feature,/MidtermPolicyScenarios/);
 assert.match(midtermPolicy,/data-midterm-policy-scenarios="pre-election-2026"/);
 assert.match(midtermPolicy,/Republican sweep of Congress/);
 assert.match(midtermPolicy,/Democratic sweep of Congress/);
 assert.match(midtermPolicy,/Split Congress/);
 assert.match(midtermPolicy,/3 January 2027/);
 assert.match(midtermPolicy,/Trump remains president/);
 assert.match(midtermPolicy,/not estimates of a partisan performance premium/);
 for(const v of ["-0.18","-0.58","2.19","16.49","17.11"]){
  assert.ok(midtermPolicy.includes(v),"Missing grouped historic return "+v);
 }
 for(const name of ["Traditional energy","Renewables","Big Tech","Financials","Healthcare"])assert.ok(midtermPolicy.includes(name));
 assert.match(midtermPolicy,/not itself reverse Trump's tariff programme/);
 assert.match(midtermPolicy,/Dividends excluded/);
 assert.match(midtermPolicy,/not a verified outcome/);
 assert.doesNotMatch(midtermPolicy,/from ["']@\/lib\/(?:blue-desk-.*-server|supabase|private)/);
 assert.doesNotMatch(midtermPolicy,/fetch\(|process\.env|cookies\(/);
});
