import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {evaluateIssuerValuation,projectIssuerValuationReviews,type PrivateIssuerValuationReview} from "../lib/power-stack-issuer-valuation.ts";
const now=new Date("2026-11-13T01:00:00Z");
const valid:PrivateIssuerValuationReview={
 ticker:"TEST",review_status:"SOURCE_REVIEWED",reviewed_at:"2026-11-12T18:00:00Z",
 price_observed_on:"2026-11-12",market_price:80,price_currency:"USD",
 price_source_url:"https://exchange.example/stock/TEST",source_timestamp_basis:"market_session",
 valuation_low:110,valuation_high:145,valuation_currency:"USD",
 valuation_method:"FCF_MULTIPLE",valuation_source_url:"https://research.example/valuation/test",
 method_explanation:"The model applies an explicit normalized free cash flow multiple to debt-adjusted equity, and requires peer comparability and scenario sensitivities.",
 downside_case:"The discount may reflect deteriorating renewal rates and less reliable operating cash flow during a capital investment cycle.",
 invalidation_test:"If next quarter reports shrinking contracted demand or rising refinancing costs, reassess the range.",
 financial_period_end:"2026-09-30",financials_currency:"USD",financials_unit:"millions",fundamental_source_url:"https://investor.example/financials/q3",
 revenue:1000,net_income:80,operating_cash_flow:145,capital_expenditure:45,share_based_compensation:15,net_debt:320,
 reviewer_note:"Independent reviewer checked market price and issuer cash flow against the model inputs before publication.",
};
const p=(v:Partial<PrivateIssuerValuationReview>={})=>({...valid,...v});
test("a reviewed case distinguishes price from model values and calculates sourced FCF",()=>{
 const r=evaluateIssuerValuation(valid,now)!;
 assert.ok(r);
 assert.equal(r.verdict,"BELOW_REVIEWED_RANGE");
 assert.equal(r.freeCashFlow,100);
 assert.equal(r.distanceToLowPct,37.5);
 assert.equal(r.riskFlags.length,0);
 assert.equal(r.priceObservedOn,"2026-11-12");
 assert.equal(r.valuationMethod,"FCF_MULTIPLE");
 assert.equal(r.financialsUnit,"millions");
});
test("expensive versus fairly priced reviewed ranges are contextual, not buy/sell calls",()=>{
 assert.equal(evaluateIssuerValuation(p({market_price:180}),now)?.verdict,"ABOVE_REVIEWED_RANGE");
 assert.equal(evaluateIssuerValuation(p({market_price:112}),now)?.verdict,"WITHIN_REVIEWED_RANGE");
 assert.equal(evaluateIssuerValuation(p({market_price:101}),now)?.verdict,"WITHIN_REVIEWED_RANGE");
});
test("negative cashflow, losses, and dilution risk stay prominently visible",()=>{
 const r=evaluateIssuerValuation(p({operating_cash_flow:25,capital_expenditure:90,
   net_income:-2,share_based_compensation:15}),now)!;
 assert.equal(r.freeCashFlow,-65);
 assert.ok(r.riskFlags.some(x=>x.includes("Negative")));
 assert.ok(r.riskFlags.some(x=>x.includes("net income")));
 assert.ok(r.riskFlags.some(x=>x.includes("compensation")));
});
test("missing, future, mismatched, stale, upstream-batch or empty evidence fails closed",()=>{
 const reject=[
  {review_status:"DRAFT"},{source_timestamp_basis:"upstream_batch"},
  {price_observed_on:"2026-11-01"},{price_observed_on:"2026-11-15"},
  {reviewed_at:"2026-08-01T00:00:00Z"},{reviewed_at:"2026-11-14T02:00:00Z"},
  {financial_period_end:"2025-12-31"},{financial_period_end:"2026-11-15"},
  {valuation_currency:"MYR"},{financials_currency:"MYR"},{financials_unit:"nonsense"},{valuation_low:160,valuation_high:140},
  {capital_expenditure:-1},{market_price:0},
  {price_source_url:"http://exchange.example"},{fundamental_source_url:"https://exchange.example/stock/TEST"},
  {valuation_source_url:"https://investor.example/financials/q3"},
  {price_source_url:"javascript:alert(1)"},
  {method_explanation:"Cheap"}, {invalidation_test:"N/A"},{downside_case:"Fine"},
 ];
 for(const variant of reject){
  assert.equal(evaluateIssuerValuation(p(variant as Partial<PrivateIssuerValuationReview>),now),null,JSON.stringify(variant));
 }
});
test("projector never reveals untracked names, does not retain stale latest over valid previous, and caps output",()=>{
 const older=p({reviewed_at:"2026-11-11T18:00:00Z",market_price:88});
 const malformed=p({reviewed_at:"2026-11-13T22:00:00Z",market_price:90});
 const result=projectIssuerValuationReviews([older,malformed,valid,p({ticker:"SECRET"})],["TEST"],now);
 assert.equal(result.length,1);
 assert.equal(result[0].marketPrice,80);
 assert.equal(projectIssuerValuationReviews([valid],[],now).length,0);
 assert.equal(projectIssuerValuationReviews([valid],["TEST"],now,0).length,0);
});
test("owner page, table, controls and audit preserve authentication, no public read, no browser write",()=>{
 const page=readFileSync(new URL("../app/power-stack/page.tsx",import.meta.url),"utf8");
 const visual=readFileSync(new URL("../components/blue-desk/PowerStackValuationWorkbench.tsx",import.meta.url),"utf8");
 const sql=readFileSync(new URL("../supabase/migrations/20261113013000_power_stack_issuer_valuation_reviews_v1.sql",import.meta.url),"utf8");
 const publicRegime=readFileSync(new URL("../app/blue-desk/regime-watch/page.tsx",import.meta.url),"utf8");
 const publicMarket=readFileSync(new URL("../app/blue-desk/markets/page.tsx",import.meta.url),"utf8");
 assert.ok(page.indexOf('from("power_stack_issuer_valuation_reviews")')>page.indexOf('if (allowError || !allowed) redirect'));
 assert.match(page,/\.eq\("owner_user_id",identity\.user\.id\)/);
 assert.match(page,/ready\?<PowerStackValuationWorkbench/);
 assert.match(page,/data-power-stack="owner-only"/);
 assert.match(page,/forecastSourceUrl:typeof record.forecast_source_url/);
 assert.match(page,/all.findIndex\(other=>other.ticker.toUpperCase\(\)===item.ticker.toUpperCase\(\)\)===index/);
 assert.match(visual,/data-power-stack-issuer-underwriting="owner-only-source-reviewed-not-trade-signals"/);
 assert.match(visual,/Missing before calling mispricing/);
 assert.match(visual,/valuation evidence missing/i);
 assert.doesNotMatch(publicRegime+publicMarket,/power_stack_issuer_valuation_reviews|PowerStackValuationWorkbench/);
 assert.equal((sql.match(/create table if not exists public\.power_stack_issuer_valuation_reviews/g)||[]).length,1);
 assert.equal((sql.match(/financials_currency text not null/g)||[]).length,1);
 assert.equal((sql.match(/financials_unit text not null/g)||[]).length,1);
 assert.equal((sql.match(/fundamental_source_url text not null/g)||[]).length,1);
 assert.equal((sql.match(/primary key \(owner_user_id,ticker,reviewed_at\)/g)||[]).length,1);
 assert.ok(sql.includes("price_currency = valuation_currency and price_currency = financials_currency"));
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/revoke all on table public\.power_stack_issuer_valuation_reviews from anon,authenticated/);
 assert.match(sql,/grant select on table public\.power_stack_issuer_valuation_reviews to authenticated/);
 assert.match(sql,/using\s*\(owner_user_id\s*=\s*\(select auth\.uid\(\)\)\)/);
 assert.doesNotMatch(sql,/grant (?:insert|update|delete|all) on table public\.power_stack_issuer_valuation_reviews to authenticated/);
 assert.doesNotMatch(visual,/\.insert\(|\.update\(|\.upsert\(/);
});
