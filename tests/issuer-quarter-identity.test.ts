import test from "node:test";
import assert from "node:assert/strict";
import {canonicalIssuerQuarter,selectExistingIssuerQuarter} from "../lib/earnings/issuer-quarter-identity.ts";

test("equivalent fiscal aliases share one key, unrelated quarters stay separate",()=>{
 for(const label of ["Q3 FY27","Q3 FY2027","FY2027 Q3","Zoom Q3 FY2027 earnings"])assert.equal(canonicalIssuerQuarter(label),"Q3 FY2027");
 assert.equal(canonicalIssuerQuarter("Q4 FY2027"),"Q4 FY2027");
 assert.equal(canonicalIssuerQuarter("unknown"),null);
});
test("existing advanced receipt wins independently of row order; canonical wins ties",()=>{
 const rows=[{fiscal_period:"Q3 FY2027",state:"due"},{fiscal_period:"Q3 FY27",state:"partial"},{fiscal_period:"Q2 FY2027",state:"published"}];
 assert.equal(selectExistingIssuerQuarter(rows,"Q3 FY2027")?.state,"partial");
 assert.equal(selectExistingIssuerQuarter([...rows].reverse(),"FY27 Q3")?.fiscal_period,"Q3 FY27");
 assert.equal(selectExistingIssuerQuarter([{...rows[0],state:"partial"},rows[1]],"Q3 FY27")?.fiscal_period,"Q3 FY2027");
 assert.equal(selectExistingIssuerQuarter(rows,"Q4 FY2027"),null);
});
