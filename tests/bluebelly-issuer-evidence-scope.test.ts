import test from "node:test";
import assert from "node:assert/strict";
import {projectFundamentalComparison,type IssuerResultRow,type IssuerMetricRow} from "../lib/bluebelly-fundamental-comparison.ts";
const now=new Date("2026-11-26T00:00:00Z");
const row:IssuerResultRow={id:"CI|Q3 FY2026",ticker:"CI",fiscal_period:"Q3 FY2026",filing_day:"2026-11-05",verification_status:"partial"};
const fact:IssuerMetricRow={result_id:row.id,metric_key:"cash_and_equivalents",value_numeric:6186000000,unit:"USD",accounting_basis:"SEC_US_GAAP",period_basis:"point_in_time",source_url:"https://www.sec.gov/Archives/edgar/data/1739940/000173994026000071/ci-20260930.htm",verification_status:"verified"};
test("quarter-end balance sheet stocks must have point-in-time scope",()=>{
 const r=projectFundamentalComparison([row],[fact,{...fact,metric_key:"long_term_debt",period_basis:"fiscal_quarter"}],[],now).find(x=>x.ticker==="CI")!;
 assert.equal(r.facts.length,1);assert.equal(r.facts[0].period,"Q3 FY2026 period end");
 assert.equal(r.valuation,null);
});
test("guidance floor is not quarter actual, consensus or REIT valuation denominator",()=>{
 const g:IssuerMetricRow={...fact,metric_key:"adjusted_eps_guidance_floor",value_numeric:30.60,unit:"USD/shares",period_basis:"fiscal_year_guidance",accounting_basis:"ISSUER_GUIDANCE_NON_GAAP"};
 const r=projectFundamentalComparison([row],[g,{...g,metric_key:"diluted_eps"}],[],now).find(x=>x.ticker==="CI")!;
 assert.equal(r.facts.length,1);assert.equal(r.facts[0].period,"FY 2026 guidance");assert.equal(r.valuation,null);
});
