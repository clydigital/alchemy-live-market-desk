import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {recapFromDecision} from "../components/blue-desk/ShortNewsRecap.tsx";
import {getRecentOfficialMacroResults} from "../lib/blue-desk-official-macro-results.ts";
import {getRecentVerifiedEarningsScorecards} from "../lib/blue-desk-earnings-results.ts";

test("BEA macro outcome must never receive issuer-verified earnings provenance",()=>{
 const m=getRecentOfficialMacroResults(new Date("2026-10-30T01:00:00Z"))[0];
 const topic={id:m.id,title:m.title,fact:m.fact,why:m.why,test:m.test,
  at:m.releaseAt,sourceUrl:m.sourceUrl,sourceName:m.sourceName,
  href:"?brief="+m.id,status:"FEATURE" as const,mechanism:m.mechanism,
  assets:m.affectedAssets,priority:7};
 const recap=recapFromDecision(topic,null);
 assert.match(recap.label,/BEA ORIGINAL RELEASE/);
 assert.doesNotMatch(recap.label,/ISSUER/);
 const e=getRecentVerifiedEarningsScorecards(new Date("2026-10-30T01:00:00Z"),7).find(x=>x.ticker==="AMZN")!;
 const issuer=recapFromDecision({...topic,id:e.id},e);
 assert.match(issuer.label,/ISSUER-REVIEWED/);
});
test("source status text in the public recap remains limited to reviewed original evidence",()=>{
 const source=readFileSync(new URL("../components/blue-desk/ShortNewsRecap.tsx",import.meta.url),"utf8");
 assert.match(source,/SOURCE-REVIEWED MARKET DEVELOPMENT/);
 assert.match(source,/PREVIEW · OUTCOME NOT YET VERIFIED/);
 assert.match(source,/BEA ORIGINAL RELEASE · SOURCE-REVIEWED/);
});
