import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  extractSecQuarterCashFlows, SEC_D1_ISSUERS, SEC_CASHFLOW_METHOD,
  type SecCashflowIssuerTicker,
} from "../lib/dossier-v2/issuer-sec-quarterly-cashflow.ts";

const C = {
  cfo: "NetCashProvidedByUsedInOperatingActivities",
  capex: "PaymentsToAcquirePropertyPlantAndEquipment",
};
type Fp = "Q1"|"Q2"|"Q3"|"FY";
function item(value: number, start: string, end: string, fp: Fp, fy: number, filed: string, accession: string, overrides:Record<string,unknown>={}) {
  return { val:value,start,end,fp,fy,filed,
    form:fp==="FY"?"10-K":"10-Q",
    accn:accession,...overrides };
}
function facts(ticker:SecCashflowIssuerTicker, company:string, cfo:object[],capex:object[]) {
  return {cik:Number(SEC_D1_ISSUERS[ticker].cik),entityName:company,
    facts:{"us-gaap":{
      [C.cfo]:{units:{USD:cfo}},
      [C.capex]:{units:{USD:capex}},
    }},
  };
}
const ASOF = "2026-10-10T19:00:00Z";

test("D1b Microsoft FY26 Q4 = July–June 10-K less July–March Q3 YTD, not a calendar-year Q4",()=>{
  const ticker="MSFT";
  const priorAccn="0000789019-26-000071",fyAccn="0000789019-26-000093";
  const start="2025-07-01";
  const q3=item(92_000_000_000,start,"2026-03-31","Q3",2026,"2026-04-28",priorAccn);
  const fy=item(143_000_000_000,start,"2026-06-30","FY",2026,"2026-07-31",fyAccn);
  const input=facts(ticker,"MICROSOFT CORP",[q3,fy],[
    item(77_000_000_000,start,"2026-03-31","Q3",2026,"2026-04-28",priorAccn),
    item(115_000_000_000,start,"2026-06-30","FY",2026,"2026-07-31",fyAccn),
  ]);
  const result=extractSecQuarterCashFlows(input,ASOF,ticker);
  const q4=result.items.find((x)=>x.fiscalQuarter===4)!;
  assert.ok(q4,result.gaps.join(";"));
  assert.equal(q4.fiscalYear,2026);
  assert.equal(q4.periodStart,"2026-04-01");
  assert.equal(q4.periodEnd,"2026-06-30");
  assert.equal(q4.cfoUsd,51_000_000_000);
  assert.equal(q4.cashPpeUsd,38_000_000_000);
  assert.equal(q4.simpleFcfUsd,13_000_000_000);
  assert.equal(q4.currentAccession,fyAccn);
  assert.equal(q4.predecessorAccession,priorAccn);
  assert.equal(q4.filingIndexUrl,"https://www.sec.gov/Archives/edgar/data/789019/000078901926000093/");
  assert.equal(q4.availableAt,"2026-08-01T00:00:00Z");
  assert.equal(q4.ticker,"MSFT");
  assert.equal(q4.entityScope,"CONSOLIDATED");
  assert.equal(q4.accountingBasis,"US_GAAP");
  assert.equal(result.items.find((x)=>x.fiscalQuarter===3),undefined,
    "no standalone Q3 if Q2 cumulative filing is absent");

  // SEC CompanyFacts fiscal Q1 FY2026 ends Sep 2025, not Sep 2026.
  const q1Accn="0000789019-25-000093";
  const q1=facts(ticker,"Microsoft Corporation",[
    item(31_000_000_000,start,"2025-09-30","Q1",2026,"2025-10-29",q1Accn),
  ],[
    item(17_000_000_000,start,"2025-09-30","Q1",2026,"2025-10-29",q1Accn),
  ]);
  const q1Result=extractSecQuarterCashFlows(q1,ASOF,ticker);
  assert.equal(q1Result.items[0]?.fiscalYear,2026);
  assert.equal(q1Result.items[0]?.fiscalQuarter,1);
  assert.equal(q1Result.items[0]?.periodEnd,"2025-09-30");
});

test("D1b Amazon Q2 2026 reconciles cash-flow YTD, excludes net PPE sale proceeds and lease additions",()=>{
  const q1="0001018724-26-000014",q2="0001018724-26-000026";
  const input=facts("AMZN","Amazon.com, Inc.",[
    item(26_032_000_000,"2026-01-01","2026-03-31","Q1",2026,"2026-05-01",q1),
    item(71_419_000_000,"2026-01-01","2026-06-30","Q2",2026,"2026-07-31",q2),
  ],[
    item(44_203_000_000,"2026-01-01","2026-03-31","Q1",2026,"2026-05-01",q1),
    item(98_411_000_000,"2026-01-01","2026-06-30","Q2",2026,"2026-07-31",q2),
  ]);
  const r=extractSecQuarterCashFlows(input,ASOF,"AMZN");
  assert.deepEqual(r.gaps,[]);
  assert.equal(r.items[0].cfoUsd,45_387_000_000);
  assert.equal(r.items[0].cashPpeUsd,54_208_000_000);
  assert.equal(r.items[0].simpleFcfUsd,-8_821_000_000);
  assert.equal(r.items[0].ticker,"AMZN");
  assert.equal(r.items[0].sourceUrl,"https://data.sec.gov/api/xbrl/companyfacts/CIK0001018724.json");
});

test("D1b Meta Q2 simple FCF is NOT company-defined FCF after financing-lease principal",()=>{
  const q1="0001628280-26-028526",q2="0001628280-26-050705";
  const input=facts("META","Meta Platforms, Inc.",[
    item(32_226_000_000,"2026-01-01","2026-03-31","Q1",2026,"2026-04-29",q1),
    item(64_088_000_000,"2026-01-01","2026-06-30","Q2",2026,"2026-07-30",q2),
  ],[
    item(18_997_000_000,"2026-01-01","2026-03-31","Q1",2026,"2026-04-29",q1),
    item(49_113_000_000,"2026-01-01","2026-06-30","Q2",2026,"2026-07-30",q2),
  ]);
  const r=extractSecQuarterCashFlows(input,ASOF,"META");
  assert.deepEqual(r.gaps,[]);
  assert.equal(r.items[0].cfoUsd,31_862_000_000);
  assert.equal(r.items[0].cashPpeUsd,30_116_000_000);
  assert.equal(r.items[0].simpleFcfUsd,1_746_000_000);
  assert.equal(r.items[0].ticker,"META");
  // An additional $0.962bn finance-lease cash principal produces ~$0.784bn
  // issuer-defined FCF. We intentionally do not label $1.746bn as that metric.
  assert.equal(r.items[0].simpleFcfUsd-962_000_000,784_000_000);
});

test("D1b cross-issuer CIK/name swapping and incompatible time vintages fail closed",()=>{
  const accn="0001018724-26-000026";
  const rows=[item(2,"2026-01-01","2026-03-31","Q1",2026,"2026-05-01",accn)];
  const amzn=facts("AMZN","Amazon.com, Inc.",rows,rows);
  assert.deepEqual(extractSecQuarterCashFlows(amzn,ASOF,"MSFT").gaps,["CIK_MISMATCH_OR_MISSING"]);
  const fake=facts("MSFT","Amazon.com, Inc.",rows,rows);
  assert.deepEqual(extractSecQuarterCashFlows(fake,ASOF,"MSFT").gaps,["ENTITY_IDENTITY_MISMATCH"]);
  const future=facts("AMZN","Amazon.com, Inc.",[
    item(10,"2026-01-01","2026-03-31","Q1",2026,"2026-10-12",accn),
  ],[
    item(10,"2026-01-01","2026-03-31","Q1",2026,"2026-10-12",accn),
  ]);
  assert.deepEqual(extractSecQuarterCashFlows(future,ASOF,"AMZN").items,[]);
  const comparative=facts("MSFT","MICROSOFT CORP",[
    item(1,"2024-07-01","2025-06-30","FY",2026,"2026-07-31",accn),
  ],[
    item(1,"2024-07-01","2025-06-30","FY",2026,"2026-07-31",accn),
  ]);
  assert.deepEqual(extractSecQuarterCashFlows(comparative,ASOF,"MSFT").items,[]);
});
test("D1b same issuer mismatched CFO and cash PP&E filing accessions cannot form evidence",()=>{
  const cfo=[item(50,"2025-07-01","2025-09-30","Q1",2026,"2025-10-29","0000789019-25-000093")];
  const ppe=[item(22,"2025-07-01","2025-09-30","Q1",2026,"2025-10-29","0000789019-25-000094")];
  assert.equal(extractSecQuarterCashFlows(facts("MSFT","MICROSOFT CORP",cfo,ppe),ASOF,"MSFT").items.length,0);
});
test("D1b source writer has stable SEC provider identity, four bounded issuers, no History/Story bypass",()=>{
  const s=readFileSync(new URL("../lib/dossier-v2/persist-sec-quarterly-cashflow.ts",import.meta.url),"utf8");
  const run=readFileSync(new URL("../lib/dossier-v2/manual-run.ts",import.meta.url),"utf8");
  assert.equal(SEC_CASHFLOW_METHOD,"sec-consolidated-cashflow-quarter-v1");
  assert.deepEqual(Object.keys(SEC_D1_ISSUERS).sort(),["AMZN","GOOGL","META","MSFT"]);
  assert.match(s,/persistSecIssuerCashflowEvidence/);
  assert.match(s,/issuer\.secUrl/);
  assert.match(s,/persistSensorMemory\(/);
  assert.match(s,/normalised_observation_id:obs\.id/);
  assert.match(s,/SEC_USER_AGENT_NOT_CONFIGURED/);
  assert.match(s,/CONFLICTING_FILING_REVISION_REQUIRES_ADJUDICATION/);
  assert.match(run,/for \(const ticker of \["GOOGL", "MSFT", "AMZN", "META"\] as const\)/);
  assert.match(run,/options\.persist && !options\.snapshotResult && !options\.client/);
  assert.ok(run.indexOf("persistSecIssuerCashflowEvidence")<run.indexOf("loadCanonicalCandidateSnapshot(client"));
  assert.doesNotMatch(s,/\.from\("story_thesis_versions"\)|\.from\("stories"\)/);
});
