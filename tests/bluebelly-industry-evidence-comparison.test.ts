import test from "node:test";
import assert from "node:assert/strict";
import {projectIndustryEventThreads} from "../lib/bluebelly-industry-evidence.ts";
import {buildIndustryComparison,selectIndustryPeers,type IssuerResultRow,type IssuerFactRow} from "../lib/bluebelly-industry-comparison.ts";
import {getRecentVerifiedEarningsScorecards} from "../lib/blue-desk-earnings-results.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";
const now=new Date("2026-11-26T00:00:00Z");
const url="https://www.sec.gov/Archives/edgar/data/123456/000012345626000001/quarter.htm";
const row:IssuerResultRow={id:"result-1",ticker:"TEST",company_name:"Test company",fiscal_period:"Q3 2026",filing_day:"2026-11-24",published_at:"2026-11-24T20:00:00Z",source_url:url,verification_status:"partial"};
const fact=(metric_key:string,value_numeric:number,unit="USD",extra:Partial<IssuerFactRow>={}):IssuerFactRow=>({result_id:row.id,metric_key,value_numeric,unit,accounting_basis:"SEC_US_GAAP",period_basis:"fiscal_quarter",source_url:url,verification_status:"verified",captured_at:"2026-11-25T00:00:00Z",...extra});
const news=(id:string,headline:string,summary:string,sourceUrl:string,occurredAt="2026-11-24T14:00:00Z"):NewsBriefV1=>({contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",id,headline,summary,sourceName:"Issuer original",sourceUrl,sourceKind:"primary",occurredAt,observedAt:"2026-11-25T00:00:00Z",verification:"SOURCE_VERIFIED"});
test("event threads retain identity and open question even with zero headlines",()=>{
 const a=projectIndustryEventThreads([],now),b=projectIndustryEventThreads([news("source-01","Google adjusts TPU procurement","Google discusses accelerator procurement and allocation in a source-dated report.",url)],now);
 assert.deepEqual(a.map(x=>x.id),b.map(x=>x.id));
 const q=b.find(x=>x.id==="google-accelerator-allocation")!;
 assert.equal(q.sources.length,1);assert.equal(q.stage,"MONITORING_QUESTION");
 assert.equal(q.relationships.find(x=>x.company==="NVDA")?.role,"possible_competitor");
 assert.match(q.relationships.find(x=>x.company==="NVDA")!.qualification,/hypothesis/);
 assert.equal(a.find(x=>x.id===q.id)?.evidenceState,"NO_MATCH_IN_BOUNDED_READER");
 assert.equal(a.find(x=>x.id===q.id)?.latestRelatedEventAt,null);
});
test("qualified source IDs are deduplicated and future/older/out-of-scope facts excluded",()=>{
 const item=news("source-01","Tesla and SpaceX merger discussions","A source-dated discussion of potential transaction terms and governance.",url);
 const old=news("source-02","Tesla and SpaceX merger discussions","A historical discussion of potential transaction terms and governance.","https://example.org/old","2026-11-01T00:00:00Z");
 const future=news("source-03","Tesla and SpaceX merger discussions","A future discussion of potential transaction terms and governance.","https://example.org/future","2026-11-27T00:00:00Z");
 const result=projectIndustryEventThreads([item,{...item,id:"source-04"},old,future],now).find(x=>x.id==="tesla-spacex-transaction")!;
 assert.equal(result.sources.length,1);assert.equal(result.sources[0].occurredAt,item.occurredAt);
 assert.ok(result.relationships.every(r=>r.role==="transaction_party"));
});
test("peer selection is restricted to the current public industry universe",()=>{
 assert.deepEqual(selectIndustryPeers(["NVDA","AVGO","MediaTek","AMD"],["nvda","NVDA","mediatek","UNKNOWN"]),["NVDA","MediaTek"]);
 assert.deepEqual(selectIndustryPeers(["NVDA","AVGO","AMD"],"UNKNOWN",2),["NVDA","AVGO"]);
});
test("numeric facts and margin require the same verified period and source",()=>{
 const col=buildIndustryComparison(["TEST"],[row],[fact("revenue",100),fact("operating_income",25),fact("diluted_eps",2,"USD/shares"),fact("free_cash_flow",8,"USD",{period_basis:"year_to_date"}),fact("net_income",12,"EUR"),fact("capital_expenditure",10,"USD",{verification_status:"unverified"})],[],now)[0];
 assert.equal(col.state,"VERIFIED_FILING");assert.equal(col.cells.operating_margin.value,25);assert.equal(col.cells.diluted_eps.value,2);
 assert.equal(col.cells.free_cash_flow.state,"MISSING");assert.equal(col.cells.net_income.state,"MISSING");assert.equal(col.cells.capital_expenditure.state,"MISSING");assert.equal(col.cells.valuation.value,null);
 const mixed=buildIndustryComparison(["TEST"],[row],[fact("revenue",100),fact("operating_income",25,"USD",{source_url:"https://www.sec.gov/Archives/edgar/data/123456/000012345626000002/other.htm"})],[],now)[0];
 assert.equal(mixed.cells.operating_margin.state,"MISSING");
});
test("conflicting, missing, future or stale observations cannot become figures",()=>{
 const col=buildIndustryComparison(["TEST","NONE"],[row],[fact("revenue",100),fact("revenue",150),fact("operating_income",25,"USD",{captured_at:"2026-11-27T00:00:00Z"})],[],now);
 assert.equal(col[0].cells.revenue.state,"MISSING");assert.equal(col[0].cells.operating_income.state,"MISSING");assert.equal(col[1].state,"UNAVAILABLE");
 const stale=buildIndustryComparison(["TEST"],[{...row,filing_day:"2026-05-01"}],[fact("revenue",100)],[],now)[0];
 assert.equal(stale.state,"UNAVAILABLE");
});
test("reviewed scorecard values retain text and accounting basis, never parsed into numeric ranking",()=>{
 const cards=getRecentVerifiedEarningsScorecards(now,90);
 const col=buildIndustryComparison(["AMD"],[],[],cards,now)[0];
 assert.equal(col.state,"REVIEWED_SCORECARD");assert.equal(col.cells.revenue.state,"REVIEWED_TEXT");
 assert.equal(col.cells.revenue.value,null);assert.match(col.cells.revenue.display??"",/13\.377/);
 assert.equal(col.cells.operating_margin.state,"MISSING");
 assert.equal(col.fiscalPeriod,"Q3 2026");
});
