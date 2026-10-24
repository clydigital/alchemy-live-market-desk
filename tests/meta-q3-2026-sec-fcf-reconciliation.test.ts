import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { extractSecQuarterCashFlows } from "../lib/dossier-v2/issuer-sec-quarterly-cashflow.ts";
import {
  formatSecIssuerQuarterCashflowClaim,
  getSecIssuerFcfComparison,
} from "../lib/dossier-v2/sec-cashflow-disclosure.ts";

const q2="0001628280-26-050705";
const q3="0001628280-26-066773";
function xbrl(value:number,end:"2026-06-30"|"2026-09-30",fp:"Q2"|"Q3",filed:string,accn:string) {
  return {val:value,start:"2026-01-01",end,fp,fy:2026,form:"10-Q",filed,accn};
}
function q3Facts() {
  return {
    cik:1326801,entityName:"Meta Platforms, Inc.",
    facts:{"us-gaap":{
      NetCashProvidedByUsedInOperatingActivities:{units:{USD:[
        xbrl(64_088_000_000,"2026-06-30","Q2","2026-07-30",q2),
        xbrl(96_873_000_000,"2026-09-30","Q3","2026-10-22",q3),
      ]}},
      PaymentsToAcquirePropertyPlantAndEquipment:{units:{USD:[
        xbrl(49_113_000_000,"2026-06-30","Q2","2026-07-30",q2),
        xbrl(83_055_000_000,"2026-09-30","Q3","2026-10-22",q3),
      ]}},
    }},
  };
}

test("META Q3 2026 SEC fiscal YTD subtraction is retained, with independently pinned IR comparison",()=>{
  const results=extractSecQuarterCashFlows(q3Facts(),"2026-10-25T00:00:00.000Z","META");
  assert.deepEqual(results.gaps,["2026:Q2:PRIOR_FISCAL_YTD_NOT_VERIFIED"]);
  const quarter=results.items.find(i=>i.fiscalQuarter===3)!;
  assert.ok(quarter);
  assert.equal(quarter.periodStart,"2026-07-01");
  assert.equal(quarter.periodEnd,"2026-09-30");
  assert.equal(quarter.currentAccession,q3);
  assert.equal(quarter.predecessorAccession,q2);
  assert.equal(quarter.cfoUsd,32_785_000_000);
  assert.equal(quarter.cashPpeUsd,33_942_000_000);
  assert.equal(quarter.simpleFcfUsd,-1_157_000_000);
  const reported=getSecIssuerFcfComparison(quarter)!;
  assert.ok(reported);
  assert.equal(reported.operatingCashFlowUsd,32_786_000_000);
  assert.equal(reported.financeLeasePrincipalUsd,964_000_000);
  assert.equal(reported.reportedFcfUsd,-2_120_000_000);
  assert.equal(reported.quarterizedSecCfoDifferenceUsd,1_000_000);
  assert.equal(reported.operatingCashFlowUsd-reported.cashPpeUsd-reported.financeLeasePrincipalUsd,reported.reportedFcfUsd);
  assert.equal(quarter.simpleFcfUsd-reported.financeLeasePrincipalUsd,-2_121_000_000);
  const display=formatSecIssuerQuarterCashflowClaim("Meta Platforms, Inc.",quarter,reported);
  assert.match(display,/simple cash FCF \(CFO minus cash PP&E\) −\$1\.157bn/);
  assert.match(display,/issuer-defined non-GAAP FCF −\$2\.120bn/);
  assert.match(display,/quarterly CFO \$32\.786bn/);
  assert.match(display,/finance-lease principal \$0\.964bn/);
  assert.match(display,/EXCLUDES finance-lease principal/);
  assert.match(display,/NOT issuer-reported FCF/);
  assert.match(display,/Neither figure isolates AI cash flow or establishes Story causality/);
  assert.ok(!display.includes("−$1.157bn (issuer-defined"));
  assert.equal(reported.sourceUrl,"https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Reports-Third-Quarter-2026-Results/");
});

test("META Q2 or mismatched Q3 facts never inherit Q3 2026 issuer reconciliation",()=>{
  const r=extractSecQuarterCashFlows(q3Facts(),"2026-10-25T00:00:00.000Z","META");
  const original=r.items[0];
  for(const mutated of [
    {...original,periodEnd:"2026-06-30"},
    {...original,predecessorAccession:"0001628280-26-000001"},
    {...original,cfoUsd:32_786_000_000},
    {...original,currentAccession:"0001628280-26-066774"},
    {...original,ticker:"AMZN" as const},
  ]) {
    assert.equal(getSecIssuerFcfComparison(mutated),null);
    const text=formatSecIssuerQuarterCashflowClaim("Test issuer",mutated);
    assert.doesNotMatch(text,/issuer-defined non-GAAP FCF −\$2\.120bn/);
    assert.match(text,/simple FCF EXCLUDES finance-lease principal|simple cash FCF.*EXCLUDES finance-lease principal/);
  }
});

test("issuer disclosure is source-pinned context, not a raw SEC revision or Story writer",()=>{
  const writer=readFileSync(new URL("../lib/dossier-v2/persist-sec-quarterly-cashflow.ts",import.meta.url),"utf8");
  assert.match(writer,/formatSecIssuerQuarterCashflowClaim\(issuer\.entityName, item, issuerFcfComparison\)/);
  assert.match(writer,/getSecIssuerFcfComparison\(item\)/);
  assert.match(writer,/const secOnlyClaim = formatSecIssuerQuarterCashflowClaim\(issuer\.entityName, item, null\)/);
  assert.match(writer,/contentText:secOnlyClaim/);
  assert.match(writer,/issuerReportedFcfComparison:issuerFcfComparison/);
  assert.match(writer,/issuerFcfComparison\.sourceUrl/);
  assert.match(writer,/SEC_DERIVED_CFO_MINUS_CASH_PPE_EXCLUDES_FINANCE_LEASE_PRINCIPAL/);
  assert.match(writer,/CONFLICTING_FILING_REVISION_REQUIRES_ADJUDICATION/);
  assert.doesNotMatch(writer,/\.from\("story_thesis_versions"\)|\.from\("stories"\)/);
  assert.match(writer,/if \(older\.length\) \{/);
});
