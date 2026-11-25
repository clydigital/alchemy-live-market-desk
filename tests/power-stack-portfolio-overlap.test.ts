import test from "node:test";
import assert from "node:assert/strict";
import {projectPortfolioOverlap} from "../lib/power-stack-portfolio-overlap.ts";
import type {OpportunityRow} from "../lib/power-stack-opportunity-queue.ts";
const h=(ticker:string,currency="USD")=>({ticker,name:ticker,quantity:2,currency,quantityAsOf:"2026-10-02"});
const q=(currency:string,observed_on:string)=>({price:100,currency,observed_on,source_url:"https://example.com/price",timestamp_basis:"source_observation"});
const now=new Date("2026-11-26T00:00:00Z");
test("sleeves separated by currency and price session; warrant excluded",()=>{
 const a=projectPortfolioOverlap([h("XOM"),h("TSLA"),h("YTL","MYR"),h("6742UW","MYR")],new Map([["XOM",q("USD","2026-11-24")],["TSLA",q("USD","2026-11-25")],["6742.KL",q("MYR","2026-11-25")]]),[],t=>t==="YTL"?"6742.KL":t,now);
 assert.equal(a.sleeves.length,3);assert.deepEqual(a.excluded,["6742UW"]);assert.equal(a.sleeves[0].total,200);
});
test("unverified quantity, mismatched currency and future price remain unvalued",()=>{
 const a=projectPortfolioOverlap([h("XOM"),h("TTWO"),{...h("TSLA"),quantityAsOf:null}],new Map([["XOM",q("MYR","2026-11-24")],["TTWO",q("USD","2026-11-27")],["TSLA",q("USD","2026-11-24")]]),[],t=>t,now);
 assert.equal(a.sleeves.length,0);assert.equal(a.unvalued.length,3);
});
test("qualitative overlapping drivers do not qualify valuation",()=>{
 const o={ticker:"CVX",company:"Chevron",drivers:["Oil / gas prices"],state:"MISSING_MODEL"} as OpportunityRow;
 const a=projectPortfolioOverlap([h("XOM")],new Map(),[o],t=>t,now);
 assert.equal(a.candidates[0].state,"SHARED_DRIVERS");assert.equal(a.candidates[0].valuationState,"MISSING_MODEL");
});
