import assert from "node:assert/strict";
import test from "node:test";
import {evaluatePegResearch,repricePegResearch, type PegResearchObservation} from "../lib/power-stack-peg-research.ts";
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


test("new owner source-dated quote correctly re-prices older analyst EPS without silently revising estimates",()=>{
 const old=evaluatePegResearch(base,new Date("2026-11-13T05:00:00Z"));
 const quote={price:397.45,currency:"USD",observed_on:"2026-11-12",
  source_url:"https://open.longbridge.com/docs/quote/pull/quote",timestamp_basis:"source_observation",
  source_recorded_at:"2026-11-12T21:00:00Z"};
 const result=repricePegResearch(base,quote,new Date("2026-11-13T05:00:00Z"));
 assert.equal(result.quoteBasis,"FRESH_OWNER_PRICE");
 assert.equal(result.quotePriceUsed,397.45);
 assert.equal(result.quoteObservedOn,"2026-11-12");
 assert.equal(result.forecastRetrievedOn,"2026-11-10T00:00:00Z");
 assert.equal(result.hasNativeEstimateRevision,false);
 assert.ok((result.forwardPE??0)>(old.forwardPE??0));
 assert.ok(result.quoteRefreshWarning?.includes("estimate revision vintage"));
});
test("batch timestamps, stale quotes, wrong currency, future prices and possible stock splits cannot update PEG",()=>{
 const quote={price:397.45,currency:"USD",observed_on:"2026-11-12",
  source_url:"https://open.longbridge.com/docs/quote/pull/quote",timestamp_basis:"source_observation"};
 const now=new Date("2026-11-13T05:00:00Z");
 const bad=[{timestamp_basis:"upstream_batch"},{currency:"MYR"},{observed_on:"2026-12-02"},
  {observed_on:"2026-10-20"},{price:0},{price:1200},{price:50},
  {source_url:"http://example.com"},{source_url:"javascript:alert(1)"}];
 for(const patch of bad){
  const r=repricePegResearch(base,{...quote,...patch},now);
  assert.equal(r.quoteBasis,"ORIGINAL_FORECAST_SNAPSHOT",JSON.stringify(patch));
  assert.equal(r.quoteObservedOn,"2026-11-09");
 }
});
test("negative EPS growth stays PEG N/A despite refreshed quotes",()=>{
 const input={...base,eps_first_fy:12.16,eps_second_fy:10.15};
 const r=repricePegResearch(input,{price:169.78,currency:"USD",observed_on:"2026-11-12",
  source_url:"https://open.longbridge.com/docs/quote/pull/quote",timestamp_basis:"source_observation"},
  new Date("2026-11-13T05:00:00Z"));
 assert.equal(r.reason,"NON_POSITIVE_GROWTH");
 assert.equal(r.forwardPEG,null);
});
