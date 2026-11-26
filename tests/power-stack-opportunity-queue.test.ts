import test from "node:test";
import assert from "node:assert/strict";
import {projectOpportunityQueue,isNonIssuerInstrument} from "../lib/power-stack-opportunity-queue.ts";
import type {PublicEquityCoverageRow} from "../lib/bluebelly-equity-coverage.ts";
import type {IssuerReviewResult} from "../lib/power-stack-issuer-valuation.ts";
const now=new Date("2026-11-26T00:00:00Z");
const quote=(ticker:string):PublicEquityCoverageRow=>({ticker,company:ticker,region:"US",exchange:"NYSE",currency:"USD",timeZone:"America/New_York",priority:"CORE",theme:"AI",status:"SOURCE_DATED",price:100,changePct:-2,asOf:"2026-11-24",sourceName:"Test source",sourceUrl:"https://example.com/quote"});
const model:IssuerReviewResult={ticker:"NVDA",verdict:"BELOW_REVIEWED_RANGE",reviewedAt:"2026-11-25T00:00:00Z",priceObservedOn:"2026-11-24",financialPeriodEnd:"2026-09-30",financialsUnit:"millions",marketPrice:100,currency:"USD",valuationLow:120,valuationHigh:150,distanceToLowPct:20,distanceToHighPct:50,cashFlowFromOperations:15,capitalExpenditure:5,freeCashFlow:10,netIncome:10,revenue:100,shareBasedCompensation:1,netDebt:0,riskFlags:[],valuationMethod:"EARNINGS_MULTIPLE",methodExplanation:"Reviewed assumptions",downsideCase:"Scenario",invalidationTest:"Recheck",reviewerNote:"Test",priceSourceUrl:"https://example.com/quote",fundamentalSourceUrl:"https://example.org/filing",valuationSourceUrl:"https://example.org/model"};
test("shared universe drives queue, archived owner-only symbols remain explicit gaps",()=>{
 const rows=projectOpportunityQueue([quote("NVDA"),quote("CI")],[],[model],[{ticker:"CI",name:"Cigna"},{ticker:"DELL",name:"Dell"}],now);
 assert.equal(rows.length,3);assert.equal(rows[0].ticker,"NVDA");assert.ok(Math.abs(rows[0].rangeUpsidePct!-20)<1e-9);
 assert.equal(rows[0].state,"EVIDENCE_GAP");assert.ok(rows[0].gaps.some(g=>g.includes("base/bear")));
 assert.equal(rows.find(r=>r.ticker==="DELL")?.state,"OUTSIDE_BB");assert.equal(rows.find(r=>r.ticker==="DELL")?.price,null);
});
test("no stale, incompatible or later-priced review promoted",()=>{
 for(const q of [{...quote("NVDA"),asOf:"2026-11-01"},{...quote("NVDA"),asOf:"2026-11-23"},{...quote("NVDA"),currency:"EUR" as const},{...quote("NVDA"),price:110}]){
  const r=projectOpportunityQueue([q],[],[model],[],now)[0];assert.equal(r.model,null);assert.equal(r.rangeUpsidePct,null);
 }
});
test("quality flags remain risk-review; driver overlap not a correlation score",()=>{
 const rows=projectOpportunityQueue([quote("NVDA"),quote("AVGO"),quote("CI")],[],[{...model,riskFlags:["Negative cash flow"]}],[],now);
 assert.equal(rows[0].state,"RISK_REVIEW");
 assert.ok(rows.find(r=>r.ticker==="NVDA")?.drivers.includes("AI compute capex"));
 assert.ok(rows.find(r=>r.ticker==="AVGO")?.drivers.includes("AI compute capex"));
 assert.ok(!rows.find(r=>r.ticker==="CI")?.drivers.includes("AI compute capex"));
});

test("funds and digital assets do not enter operating-company valuation; unknown equity remains an explicit gap",()=>{
 const assets=["3191.HK","NLR","BTC","TLH","SPY","UNKNOWN"].map(ticker=>({ticker,name:ticker}));
 for(const t of assets.slice(0,-1))assert.equal(isNonIssuerInstrument(t.ticker),true);
 assert.equal(isNonIssuerInstrument(" nlr "),true);
 assert.equal(isNonIssuerInstrument("UNKNOWN"),false);
 const rows=projectOpportunityQueue([quote("NVDA")],[],[],assets,now);
 assert.deepEqual(rows.map(r=>r.ticker).sort(),["NVDA","UNKNOWN"]);
 assert.equal(rows.find(r=>r.ticker==="UNKNOWN")?.state,"OUTSIDE_BB");
 assert.equal(assets.length,6);
});
