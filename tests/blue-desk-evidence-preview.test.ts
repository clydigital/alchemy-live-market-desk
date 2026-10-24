import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { describePublicEvidenceClaim } from "../lib/blue-desk-evidence-preview.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sec=(company:string,more:string)=>
 company+". SEC XBRL observations; each line retains its own period and filing date. Do not combine mismatched periods, assume cash is unrestricted, or infer missing debt is zero. "+more;
const revenue="RevenueFromContractWithCustomerExcludingAssessedTax: 181712000000 USD; period 2026-01-01 to 2026-09-30; filed 2026-10-22; form 10-Q; accession 0001628280-26-066773.";
const oldDebt="LongTermDebt: 83664000000 USD; period instant to 2026-06-30; filed 2026-07-30; form 10-Q; accession 0001628280-26-050705.";
const currentDebt="LongTermDebtCurrent: 80922000000 USD; period instant to 2026-09-30; filed 2026-10-22; form 10-Q; accession 0001628280-26-066773.";
test("SEC XBRL facts become compact labelled cards, retaining distinct reporting vintages",()=>{
 const result=describePublicEvidenceClaim(sec("Meta Platforms",revenue+" "+oldDebt+" "+currentDebt));
 assert.equal(result.kind,"SEC_XBRL");
 assert.equal(result.title,"Meta Platforms — SEC filing");
 assert.equal(result.totalFacts,3);
 assert.equal(result.needsReview,true);
 assert.equal(result.facts[0].concept,"RevenueFromContractWithCustomerExcludingAssessedTax");
 assert.equal(result.facts[0].valueLabel,"US$181.71bn");
 assert.equal(result.facts[0].period,"From 1 Jan 2026 to 30 Sept 2026");
 const old=result.facts.find(f=>f.concept==="LongTermDebt");
 assert.equal(old?.period,"As at 30 Jun 2026");
 assert.equal(old?.filed,"30 Jul 2026");
 const current=result.facts.find(f=>f.concept==="LongTermDebtCurrent");
 assert.equal(current?.period,"As at 30 Sept 2026");
 assert.match(result.summary,/Do not combine them/);
});
test("unknown SEC concepts never infer missing debt or cash flow; corrupted SEC bulk fails safely",()=>{
 const unknown=describePublicEvidenceClaim(sec("Tesla","UnregisteredMetric: 123456789 USD; period instant to 2026-09-30; filed 2026-10-22; form 10-Q; accession 0001628280-26-066775."));
 assert.equal(unknown.kind,"SEC_XBRL");
 assert.equal(unknown.facts.length,0);
 assert.equal(unknown.totalFacts,1);
 assert.equal(unknown.needsReview,true);
 const malformed=describePublicEvidenceClaim(sec("Tesla","LongTermDebtCurrent: unknown USD; period strange; filed today."));
 assert.equal(malformed.kind,"SEC_XBRL");
 assert.equal(malformed.facts.length,0);
 assert.equal(malformed.totalFacts,0);
});
test("ordinary text gets bounded preview without being rewritten or mistaken for SEC data",()=>{
 const original="Official release: "+("Research context, not a price reaction. ".repeat(30));
 const result=describePublicEvidenceClaim(original);
 assert.equal(result.kind,"TEXT");
 assert.ok(result.summary.length<=230);
 assert.ok(result.summary.endsWith("…"));
 assert.deepEqual(result.facts,[]);
});
test("Story reader contains exactly one raw evidence view behind details; sidebar is a short index",()=>{
 const source=read("app/blue-desk/stories/[articleId]/page.tsx");
 const sidebar=source.slice(source.indexOf('id="story-evidence"'));
 assert.match(source,/describePublicEvidenceClaim\(claim\.claimText\)/);
 assert.match(source,/<details className=\{styles\.rawEvidenceDetails\}>/);
 assert.match(source,/<pre>\{claim\.claimText\}<\/pre>/);
 assert.doesNotMatch(sidebar,/<p>\{claim\.claimText\}<\/p>/);
 assert.doesNotMatch(source,/title=\{claim\.claimText\}/);
 assert.match(source,/id=\{"evidence-" \+ claim\.evidenceId\}/);
 assert.match(sidebar,/href=\{"#evidence-" \+ claim\.evidenceId\}/);
});


const canonicalMetaQ3="Meta Platforms, Inc. consolidated FY2026 Q3 CFO $32785000000; cash PP&E $33942000000; simple FCF (CFO minus cash PP&E) $-1157000000 (USD; quarter ended 2026-09-30). SEC XBRL values use filed 2026-10-22 and prior-quarter fiscal-YTD subtraction. Excludes separately disclosed finance-lease principal; NOT AI-only cash flow or Story causality.";
const qualifiedMetaContext={
  sourceName:"U.S. Securities and Exchange Commission",
  sourceUrl:"https://data.sec.gov/api/xbrl/companyfacts/CIK0001326801.json",
  availableAt:"2026-10-23T00:00:00Z",
  editionAsOf:"2026-10-24T01:00:00Z",
};
test("META Q3 stored canonical SEC text renders as simple FCF with independently sourced issuer comparison",()=>{
 const preview=describePublicEvidenceClaim(canonicalMetaQ3,qualifiedMetaContext);
 assert.equal(preview.kind,"SEC_CASHFLOW");
 assert.equal(preview.facts.length,3);
 assert.deepEqual(preview.facts.map(f=>f.valueLabel),["US$32.785bn","US$33.942bn","−US$1.157bn"]);
 assert.match(preview.summary,/excludes finance-lease principal/);
 assert.match(preview.issuerComparison?.detail||"",/−US\$2\.120bn/);
 assert.match(preview.issuerComparison?.detail||"",/US\$0\.964bn/);
 assert.match(preview.issuerComparison?.detail||"",/not established/);
 assert.match(preview.issuerComparison?.detail||"",/not additional evidence in the frozen Story/);
 assert.equal(preview.issuerComparison?.sourceUrl,
   "https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Reports-Third-Quarter-2026-Results/");
});
test("META Q3 IR comparison refuses missing/late/source-mismatched/retroactive Context",()=>{
 const invalid=[
  {},
  {...qualifiedMetaContext,sourceName:"Online comment"},
  {...qualifiedMetaContext,sourceUrl:"https://other.example.com/meta"},
  {...qualifiedMetaContext,availableAt:"2026-10-25T00:00:00Z"},
  {...qualifiedMetaContext,editionAsOf:"2026-10-21T09:00:00Z"},
  {...qualifiedMetaContext,editionAsOf:null},
 ];
 for(const ctx of invalid){
  const v=describePublicEvidenceClaim(canonicalMetaQ3,ctx);
  assert.equal(v.kind,"SEC_CASHFLOW");
  assert.equal(v.issuerComparison,undefined,JSON.stringify(ctx));
 }
 const spoof=canonicalMetaQ3.replace("$-1157000000","$-2120000000");
 const v=describePublicEvidenceClaim(spoof,qualifiedMetaContext);
 assert.equal(v.issuerComparison,undefined);
 assert.equal(v.kind,"TEXT");
});
test("other issuer SEC quarter texts get simple cashflow labels, never META comparison",()=>{
 const another=canonicalMetaQ3.replace("Meta Platforms, Inc.","Another Company")
   .replace("FY2026 Q3","FY2026 Q2").replace("2026-09-30","2026-06-30");
 const r=describePublicEvidenceClaim(another,qualifiedMetaContext);
 assert.equal(r.kind,"SEC_CASHFLOW");
 assert.equal(r.issuerComparison,undefined);
 assert.equal(r.facts[2].valueLabel,"−US$1.157bn");
});
test("Bluebelly exact article reader retains original raw claim while separating IR source",()=>{
 const source=read("app/blue-desk/stories/[articleId]/page.tsx");
 assert.match(source,/sourceName:claim\.sourceName,sourceUrl:claim\.sourceUrl/);
 assert.match(source,/editionAsOf:article\.dossierAsOf \|\| article\.generatedAt/);
 assert.match(source,/evidence\.issuerComparison/);
 assert.match(source,/data-separate-issuer-source="true"/);
 assert.match(source,/sourceUrl} target="_blank"/);
 assert.match(source,/<pre>\{claim\.claimText\}<\/pre>/);
});
