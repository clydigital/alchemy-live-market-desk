import assert from "node:assert/strict";
import test from "node:test";
import {evaluatePegResearch, type PegResearchObservation} from "../lib/power-stack-peg-research.ts";
const base:PegResearchObservation={
 ticker:"TSLA",retrieved_at:"2026-11-10T00:00:00Z",estimate_native_updated_at:null,
 forecast_first_fy_end:"2027-12-31",forecast_second_fy_end:"2028-12-31",
 eps_first_fy:2.02264,eps_second_fy:2.86282,first_fy_analysts:24,second_fy_analysts:21,
 quote_price:378.05,quote_observed_on:"2026-11-09",quote_currency:"USD",estimate_currency:"USD",
 forecast_source:"FMP annual analyst estimates",forecast_source_url:"https://site.financialmodelingprep.com/developer/docs/stable/financial-estimates",
 quote_source:"FMP stock quote"
};
const now=new Date("2026-11-10T01:00:00Z");
test("one-year forecast PEG is explicit, non-GAAP and retrieval-only",()=>{
 const out=evaluatePegResearch(base,now);
 assert.equal(out.quality,"indicative");assert.equal(out.reason,"OK_RETRIEVAL_ONLY");
 assert.equal(out.hasNativeEstimateRevision,false);
 assert.ok((out.forwardPE??0)>180&&(out.forwardPE??0)<190);
 assert.ok((out.forwardPEG??0)>4&&(out.forwardPEG??0)<5);
});
test("negative EPS growth is not falsely ranked as a cheap PEG",()=>{
 const out=evaluatePegResearch({...base,ticker:"XOM",quote_price:164.73,
 forecast_first_fy_end:"2027-12-31",forecast_second_fy_end:"2028-12-31",
 eps_first_fy:12.16468,eps_second_fy:10.15475},now);
 assert.equal(out.forwardPEG,null);assert.equal(out.reason,"NON_POSITIVE_GROWTH");
});
test("stale quote and retrieval are clearly marked, never live",()=>{
 assert.equal(evaluatePegResearch({...base,quote_observed_on:"2026-10-30"},now).reason,"STALE_PRICE");
 assert.equal(evaluatePegResearch({...base,retrieved_at:"2026-09-01T00:00:00Z"},now).reason,"STALE_RETRIEVAL");
});
test("misaligned fiscal years, future retrieval, and mismatched currencies are rejected",()=>{
 assert.equal(evaluatePegResearch({...base,forecast_second_fy_end:"2029-12-31"},now).quality,"unavailable");
 assert.equal(evaluatePegResearch({...base,retrieved_at:"2027-11-10T00:00:00Z"},now).quality,"unavailable");
 assert.equal(evaluatePegResearch({...base,estimate_currency:"MYR"},now).reason,"CURRENCY_MISMATCH");
});
test("a forecast period date is not treated as the analyst revision date",()=>{
 const out=evaluatePegResearch(base,now);
 assert.equal(out.hasNativeEstimateRevision,false);
 assert.equal(out.forecastRetrievedOn,"2026-11-10T00:00:00Z");
});
