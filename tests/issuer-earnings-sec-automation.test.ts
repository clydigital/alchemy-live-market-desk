import test from "node:test";
import assert from "node:assert/strict";
import {extractSecEarningsQuarter,parseFiscalQuarter} from "../lib/earnings/sec-quarter-facts.ts";
const accn="0000001234-26-000101";
const row=(val:number,overrides:Record<string,unknown>={})=>({
 start:"2026-07-01",end:"2026-09-30",fy:2027,fp:"Q3",
 form:"10-Q",filed:"2026-11-23",accn,val,...overrides,
});
function fixture(revenue=10000000000){
 return {cik:1234,entityName:"Test Issuer Inc.",facts:{"us-gaap":{
  RevenueFromContractWithCustomerExcludingAssessedTax:{units:{USD:[row(revenue)]}},
  EarningsPerShareDiluted:{units:{"USD/shares":[row(1.37)]}},
  OperatingIncomeLoss:{units:{USD:[row(1230000000)]}},
 }}};
}
const input={ticker:"TEST",cik:1234,fiscalPeriod:"Q3 FY27",dueDay:"2026-11-24",asOfDay:"2026-11-24"};
test("recognises short and full fiscal period labels without equating an annual total to Q4",()=>{
 assert.deepEqual(parseFiscalQuarter("Q3 FY27"),{quarter:3,year:2027});
 assert.deepEqual(parseFiscalQuarter("FY2027 Q3"),{quarter:3,year:2027});
 assert.deepEqual(parseFiscalQuarter("Q3 2027"),{quarter:3,year:2027});
 assert.equal(parseFiscalQuarter("next fiscal year"),null);
 assert.equal(extractSecEarningsQuarter({...input,fiscalPeriod:"Q4 FY27",payload:fixture()}),null);
});
test("extracts same-filing US-GAAP quarter income facts only",()=>{
 const result=extractSecEarningsQuarter({...input,payload:fixture()});
 assert.ok(result);
 assert.equal(result.accession,accn);
 assert.equal(result.filed,"2026-11-23");
 assert.equal(result.metrics.length,3);
 assert.equal(result.metrics.find(m=>m.key==="revenue")?.value,10000000000);
 assert.equal(result.metrics.find(m=>m.key==="diluted_eps")?.value,1.37);
 assert.ok(result.filingUrl.includes("/000000123426000101/"));
});
test("rejects an issuer CIK mismatch, future filing, old comparatives and wrong fiscal year",()=>{
 assert.equal(extractSecEarningsQuarter({...input,cik:4567,payload:fixture()}),null);
 const future=fixture();
 const gaap=(future.facts as Record<string,unknown>)["us-gaap"] as Record<string,any>;
 for(const item of Object.values(gaap))for(const unit of Object.values(item.units) as Array<Array<Record<string,unknown>>>)for(const fact of unit)fact.filed="2026-11-25";
 assert.equal(extractSecEarningsQuarter({...input,payload:future}),null);
 const old=fixture();
 const oldGaap=(old.facts as Record<string,unknown>)["us-gaap"] as Record<string,any>;
 for(const item of Object.values(oldGaap))for(const unit of Object.values(item.units) as Array<Array<Record<string,unknown>>>)for(const fact of unit)fact.fy=2026;
 assert.equal(extractSecEarningsQuarter({...input,payload:old}),null);
});
test("refuses conflicting same-accession financial values",()=>{
 const payload=fixture();
 const gaap=(payload.facts as Record<string,unknown>)["us-gaap"] as Record<string,any>;
 gaap.RevenueFromContractWithCustomerExcludingAssessedTax.units.USD.push(row(15000000000));
 assert.equal(extractSecEarningsQuarter({...input,payload}),null);
});
