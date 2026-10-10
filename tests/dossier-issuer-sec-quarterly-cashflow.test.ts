import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { extractAlphabetSecQuarterCashFlows } from "../lib/dossier-v2/issuer-sec-quarterly-cashflow.ts";

const asOf = "2026-10-10T19:00:00.000Z";
const concepts = {
  cfo: "NetCashProvidedByUsedInOperatingActivities",
  capex: "PaymentsToAcquirePropertyPlantAndEquipment",
} as const;
function entry(value: number,start: string,end: string,fp:"Q1"|"Q2"|"Q3"|"FY",filed:string,accn:string,overrides:Record<string,unknown>={}) {
  return {
    val:value, start,end,form:fp==="FY"?"10-K":"10-Q",fp,fy:2026,
    filed, accn, frame:null, ...overrides,
  };
}
const q1Accn="0001652044-26-000048",q2Accn="0001652044-26-000071";
function fixture(overrides: {
  q1Cfo?: number; q1Capex?: number; q2CfoYtd?: number; q2CapexYtd?: number;
  q2AccnCapex?: string; wrongStart?: boolean; removeQ1?: boolean; fileDate?: string;
  cik?: number; entityName?: string;
}={}) {
  const q1=entry(overrides.q1Cfo??45_790_000_000,"2026-01-01","2026-03-31","Q1","2026-04-24",q1Accn);
  const q1Cap=entry(overrides.q1Capex??35_674_000_000,"2026-01-01","2026-03-31","Q1","2026-04-24",q1Accn);
  const q2=entry(overrides.q2CfoYtd??84_859_000_000,"2026-01-01","2026-06-30","Q2",overrides.fileDate??"2026-07-23",q2Accn);
  const q2Cap=entry(overrides.q2CapexYtd??80_598_000_000,overrides.wrongStart?"2026-02-01":"2026-01-01","2026-06-30","Q2",overrides.fileDate??"2026-07-23",overrides.q2AccnCapex??q2Accn);
  return {
    cik:overrides.cik??1652044,
    entityName:overrides.entityName??"Alphabet Inc.",
    facts:{"us-gaap":{
      [concepts.cfo]:{units:{USD:overrides.removeQ1?[q2]:[q1,q2]}},
      [concepts.capex]:{units:{USD:overrides.removeQ1?[q2Cap]:[q1Cap,q2Cap]}},
    }},
  };
}
test("D1a Q2 SEC XBRL YTD MUST be subtracted from exact prior Q1 before publishing CFO capex FCF",()=>{
  const r=extractAlphabetSecQuarterCashFlows(fixture(),asOf);
  assert.deepEqual(r.gaps,[]);
  assert.equal(r.items.length,2);
  const q2=r.items[0];
  assert.equal(q2.periodStart,"2026-04-01");
  assert.equal(q2.periodEnd,"2026-06-30");
  assert.equal(q2.currentAccession,q2Accn);
  assert.equal(q2.predecessorAccession,q1Accn);
  assert.equal(q2.cfoUsd,39_069_000_000);
  assert.equal(q2.cashPpeUsd,44_924_000_000);
  assert.equal(q2.simpleFcfUsd,-5_855_000_000);
  assert.equal(q2.capexToPositiveCfo,Number((44_924/39_069).toFixed(6)));
  assert.equal(q2.componentCfoYtdUsd,84_859_000_000);
  assert.equal(q2.predecessorCfoYtdUsd,45_790_000_000);
  assert.equal(q2.ticker,"GOOGL");
  assert.equal(q2.entityScope,"CONSOLIDATED");
  assert.equal(q2.accountingBasis,"US_GAAP");
  assert.equal(q2.availableAt,"2026-07-24T00:00:00Z");
  assert.equal(q2.sourceUrl,"https://data.sec.gov/api/xbrl/companyfacts/CIK0001652044.json");
  assert.equal(q2.filingIndexUrl,"https://www.sec.gov/Archives/edgar/data/1652044/000165204426000071/");
  const q1=r.items[1];
  assert.equal(q1.periodStart,"2026-01-01");
  assert.equal(q1.cfoUsd,45_790_000_000);
  assert.equal(q1.cashPpeUsd,35_674_000_000);
  assert.equal(q1.simpleFcfUsd,10_116_000_000);
  assert.notEqual(q1.observationIdentity,q2.observationIdentity);
});
test("D1a missing predecessor YTD cannot be mistaken for consolidated quarter",()=>{
  const r=extractAlphabetSecQuarterCashFlows(fixture({removeQ1:true}),asOf);
  assert.deepEqual(r.items,[]);
  assert.ok(r.gaps.some((g)=>g.includes("PRIOR_FISCAL_YTD_NOT_VERIFIED")));
});
test("D1a CFO or capex in different accession or fiscal start fail closed",()=>{
  let r=extractAlphabetSecQuarterCashFlows(fixture({q2AccnCapex:"0001652044-26-000072"}),asOf);
  assert.ok(!r.items.some((x)=>x.fiscalQuarter===2));
  r=extractAlphabetSecQuarterCashFlows(fixture({wrongStart:true}),asOf);
  assert.ok(!r.items.some((x)=>x.fiscalQuarter===2));
});
test("D1a SEC issuer identity and exact U.S. dollar concepts are mandatory",()=>{
  let r=extractAlphabetSecQuarterCashFlows(fixture({cik:1018724}),asOf);
  assert.deepEqual(r.items,[]);
  assert.deepEqual(r.gaps,["CIK_MISMATCH_OR_MISSING"]);
  r=extractAlphabetSecQuarterCashFlows(fixture({entityName:"Amazon.com Inc."}),asOf);
  assert.deepEqual(r.items,[]);
  assert.deepEqual(r.gaps,["ENTITY_IDENTITY_MISMATCH"]);
  const data=fixture();delete (data.facts["us-gaap"] as Record<string,unknown>)[concepts.capex];
  r=extractAlphabetSecQuarterCashFlows(data,asOf);
  assert.equal(r.items.length,0);
});
test("D1a day-only SEC filed date is not a precise release clock: future filing excluded",()=>{
  const r=extractAlphabetSecQuarterCashFlows(fixture({fileDate:"2026-10-11"}),asOf);
  assert.ok(!r.items.some((x)=>x.fiscalQuarter===2));
});
test("D1a negative CFO yields null capex/CFO, not a negative or infinite coverage ratio",()=>{
  const r=extractAlphabetSecQuarterCashFlows(fixture({q2CfoYtd:40_000_000_000}),asOf);
  const q2=r.items.find((x)=>x.fiscalQuarter===2)!;
  assert.equal(q2.cfoUsd,-5_790_000_000);
  assert.equal(q2.simpleFcfUsd,-50_714_000_000);
  assert.equal(q2.capexToPositiveCfo,null);
});
test("D1a repeat is idempotent; amended observation changes content hash for deliberate conflict hold",()=>{
  const r=extractAlphabetSecQuarterCashFlows(fixture(),asOf);
  const again=extractAlphabetSecQuarterCashFlows(fixture(),"2026-10-11T00:00:00.000Z");
  assert.deepEqual(r.items.map(x=>x.contentHash),again.items.map(x=>x.contentHash));
  const revised=extractAlphabetSecQuarterCashFlows(fixture({q2CfoYtd:84_700_000_000}),asOf);
  assert.notEqual(r.items[0].contentHash,revised.items[0].contentHash);
  assert.equal(r.items[0].observationIdentity,revised.items[0].observationIdentity);
});
test("D1a production bridge is authorised/live only, uses canonical memory and holds source revisions",()=>{
  const writer=readFileSync(new URL("../lib/dossier-v2/persist-sec-quarterly-cashflow.ts",import.meta.url),"utf8");
  const manual=readFileSync(new URL("../lib/dossier-v2/manual-run.ts",import.meta.url),"utf8");
  assert.match(writer,/SEC_USER_AGENT_NOT_CONFIGURED/);
  assert.match(writer,/HISTORICAL_OR_FUTURE_REPLAY/);
  assert.match(writer,/CONFLICTING_FILING_REVISION_REQUIRES_ADJUDICATION/);
  assert.match(writer,/persistSensorMemory\(/);
  assert.match(writer,/\.from\("normalised_observations"\)/);
  assert.match(writer,/\.from\("intelligence_evidence"\)/);
  assert.match(writer,/normalised_observation_id:obs.id/);
  assert.match(writer,/evidence_class:"regulatory_filing"/);
  assert.doesNotMatch(writer,/\.from\("story_thesis_versions"\)|\.from\("stories"\)/);
  assert.match(manual,/persistSecIssuerCashflowEvidence/);
  assert.match(writer,/persistAlphabetSecCashflowEvidence/);
  assert.match(manual,/options.persist && !options.snapshotResult && !options.client/);
  assert.ok(manual.indexOf("persistSecIssuerCashflowEvidence")<manual.indexOf("loadCanonicalCandidateSnapshot(client"));
});
