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
