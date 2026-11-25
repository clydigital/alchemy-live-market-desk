import test from "node:test";
import assert from "node:assert/strict";
import {projectEstimateHistory} from "../lib/power-stack-estimate-history.ts";
import type {PegResearchObservation} from "../lib/power-stack-peg-research.ts";
const old:PegResearchObservation={ticker:"DELL",retrieved_at:"2026-11-10T00:15:00Z",estimate_native_updated_at:null,forecast_first_fy_end:"2027-01-31",forecast_second_fy_end:"2028-01-31",eps_first_fy:20,eps_second_fy:25,first_fy_analysts:10,second_fy_analysts:10,quote_price:300,quote_observed_on:"2026-11-09",quote_currency:"USD",estimate_currency:"USD",forecast_source:"Same provider",forecast_source_url:"https://example.com/estimates",quote_source:"Same quote"};
const latest:PegResearchObservation={...old,retrieved_at:"2026-11-25T22:00:00Z",quote_observed_on:"2026-11-24",quote_price:270,eps_second_fy:30};
const now=new Date("2026-11-26T00:00:00Z");
test("compares only archived retrievals and original quotes",()=>{
 const r=projectEstimateHistory([old,latest],now)[0];assert.equal(r.state,"RETRIEVAL_COMPARISON");assert.ok(Math.abs(r.secondChangePct!-20)<1e-9);assert.ok(Math.abs(r.priceChangePct!+10)<1e-9);assert.equal(r.nextFYMultiple,9);assert.equal(r.priorNextFYMultiple,12);assert.equal(r.multipleChangePct,-25);
});
test("provider, fiscal rollover and currency changes are not revisions",()=>{
 for(const prior of [{...old,forecast_source:"Other provider"},{...old,forecast_first_fy_end:"2026-01-31",forecast_second_fy_end:"2027-01-31",quote_observed_on:"2025-11-09"},{...old,estimate_currency:"EUR",quote_currency:"EUR"}]){
  assert.equal(projectEstimateHistory([latest,prior],now)[0].prior,null);
 }
});
test("price-source mismatch suppresses price and multiple changes, not EPS",()=>{
 const r=projectEstimateHistory([latest,{...old,quote_source:"Other quote"}],now)[0];assert.equal(r.priceChangePct,null);assert.equal(r.multipleChangePct,null);assert.ok(r.secondChangePct!==null);
});
test("reject future data and invalid periods",()=>{
 assert.equal(projectEstimateHistory([{...latest,retrieved_at:"2026-11-27T00:00:00Z"},{...old,quote_observed_on:"2026-11-11"},{...old,estimate_native_updated_at:"2026-11-26T00:00:00Z"}],now).length,0);
});
