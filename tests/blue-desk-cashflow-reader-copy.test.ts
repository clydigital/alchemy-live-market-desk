import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  readableSecCashflowLead, readableSourceArticleLead,
} from "../lib/blue-desk-cashflow-reader-copy.ts";
const claim="Meta Platforms, Inc. consolidated FY2026 Q3 CFO $32785000000; cash PP&E $33942000000; simple FCF (CFO minus cash PP&E) $-1157000000 (USD; quarter ended 2026-09-30). SEC XBRL values use filed 2026-10-22 and prior-quarter fiscal-YTD subtraction. Excludes separately disclosed finance-lease principal; NOT AI-only cash flow or Story causality.";
const ctx={
 sourceName:"U.S. Securities and Exchange Commission",
 sourceUrl:"https://data.sec.gov/api/xbrl/companyfacts/CIK0001326801.json",
 availableAt:"2026-10-24T01:00:00Z",
 editionAsOf:"2026-10-24T14:41:28.839Z",
};
test("a real current Bluebelly Meta SEC fact becomes readable without asserting AI causality",()=>{
 const r=readableSecCashflowLead(claim,ctx);
 assert.equal(r?.headline,"Meta Platforms Q3 2026: Cash PP&E exceeds operating cash flow");
 assert.match(r?.deck||"",/US\$32\.785bn SEC-derived CFO/);
 assert.match(r?.deck||"",/US\$33\.942bn cash PP&E/);
 assert.match(r?.deck||"",/simple FCF −US\$1\.157bn/);
 assert.match(r?.deck||"",/not issuer-reported FCF/);
 assert.doesNotMatch(r?.headline||"",/AI|Story|Causality/);
});
test("company and source provenance must qualify; no future or intraday backfill",()=>{
 const inputs=[
  {...ctx,sourceName:"Creator newsletter"},
  {...ctx,sourceUrl:"https://example.com/pasted-meta-values"},
  {...ctx,availableAt:"2026-10-25T00:00:00Z"},
  {...ctx,editionAsOf:"2026-10-22T12:00:00Z"},
  {...ctx,editionAsOf:null},
 ];
 for(const c of inputs)assert.equal(readableSecCashflowLead(claim,c),null,JSON.stringify(c));
 assert.equal(readableSecCashflowLead(claim.replace("$-1157000000","$-2120000000"),ctx),null);
});
test("frozen raw title only transforms if its own exact SEC evidence is present",()=>{
 const title="Meta Platforms, Inc. consolidated FY2026 Q3 CFO $32785000000; cash PP&E…";
 const evidence=[{claimText:claim,sourceName:ctx.sourceName,sourceUrl:ctx.sourceUrl,availableAt:ctx.availableAt}];
 const corrected=readableSourceArticleLead(title,evidence,ctx.editionAsOf);
 assert.equal(corrected?.headline,"Meta Platforms Q3 2026: Cash PP&E exceeds operating cash flow");
 assert.equal(readableSourceArticleLead("A genuine author-written Meta earnings story",evidence,ctx.editionAsOf),null);
 assert.equal(readableSourceArticleLead(title,[],ctx.editionAsOf),null);
 assert.equal(readableSourceArticleLead(title,[{...evidence[0],sourceUrl:"https://example.com"}],ctx.editionAsOf),null);
});
test("public home no longer replays an old SEC snapshot as the current headline",()=>{
 const page=readFileSync(new URL("../app/blue-desk/page.tsx",import.meta.url),"utf8");
 assert.match(page,/getCurrentVerifiedMarketMotion/);
 assert.match(page,/selectVerifiedNewsBriefs/);
 assert.doesNotMatch(page,/listPublishedReports/);
 assert.match(page,/newsFeature\.sourceUrl/);
 assert.doesNotMatch(page,/sourceFact|selectFrozenSourceFact|featureDisplay/);
});
