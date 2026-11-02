import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {EARNINGS_CASES} from "../lib/bluebelly-earnings-investor-stories.ts";
import {getRecentVerifiedEarningsScorecards} from "../lib/blue-desk-earnings-results.ts";
import {getDatedEarningsReaction} from "../lib/bluebelly-earnings-reaction.ts";
import {consequenceForSourceOnlyNews,consequenceForEarnings,MARKET_CONSEQUENCE_READ_VERSION} from "../lib/bluebelly-market-consequence-read-model.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";

const src=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const event:NewsBriefV1={
 contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",verification:"SOURCE_VERIFIED",
 id:"abcd-verified",headline:"Official issuer updates its financial guidance",
 summary:"The company issued a dated source-verified statement about its outlook.",
 sourceName:"Issuer IR",sourceUrl:"https://example.org/investors/results",
 sourceKind:"official",occurredAt:"2026-10-29T21:00:00Z",observedAt:"2026-10-29T21:02:00Z",
};

test("generic source-verified news stays factual: no made-up economic direction, uncertainty or share reaction",()=>{
 const model=consequenceForSourceOnlyNews(event);
 assert.ok(model);
 assert.equal(model.version,MARKET_CONSEQUENCE_READ_VERSION);
 assert.equal(model.sourceTier,"SOURCE_ONLY");
 assert.equal(model.economic.status,"NOT_ESTABLISHED");
 assert.equal(model.uncertainty.status,"NOT_ASSESSED");
 assert.equal(model.uncertainty.question,null);
 assert.equal(model.expectations.status,"NOT_VERIFIED");
 assert.equal(model.price.status,"NOT_MEASURED");
 assert.equal(model.price.sourceUrl,null);
 assert.equal(model.attribution,"CAUSE_NOT_ESTABLISHED");
 for(const bad of [{...event,verification:"UNVERIFIED" as NewsBriefV1["verification"]},
  {...event,sourceUrl:"http://example.org/unverified"},
  {...event,occurredAt:"not-a-date"}, {...event,summary:""}])
  assert.equal(consequenceForSourceOnlyNews(bad),null);
});

test("issuer economics can be reviewed without proving an analyst beat or a particular market cause",()=>{
 const asOf=new Date("2026-10-30T10:00:00Z");
 const reports=getRecentVerifiedEarningsScorecards(asOf,10);
 const amazon=reports.find(x=>x.id==="amazon-2026q3");
 const intel=reports.find(x=>x.id==="intel-2026q3");
 assert.ok(amazon&&intel);
 const observed=getDatedEarningsReaction(amazon.id,asOf);
 assert.ok(observed);
 const reviewed=consequenceForEarnings(amazon,observed);
 assert.ok(reviewed);
 assert.equal(reviewed.sourceTier,"ISSUER_RESULTS_REVIEWED");
 assert.equal(reviewed.economic.status,"SOURCE_REVIEWED");
 assert.equal(reviewed.economic.sourceUrl,amazon.sourceUrl);
 assert.equal(reviewed.expectations.status,"NOT_VERIFIED");
 assert.equal(reviewed.price.status,"DATED_SNAPSHOT");
 assert.equal(reviewed.price.observedAt,observed.extended.at);
 assert.equal(reviewed.attribution,"CAUSE_NOT_ESTABLISHED");
 assert.doesNotMatch(reviewed.price.text,/guidance caused|AI caused|priced in/i);
 const unmatched=consequenceForEarnings(intel,observed);
 assert.ok(unmatched);
 assert.equal(unmatched.price.status,"NOT_MEASURED");
 assert.equal(unmatched.price.sourceUrl,null);
 const guidanced=consequenceForEarnings(intel,null);
 assert.equal(guidanced?.expectations.status,"ISSUER_GUIDANCE_ONLY");
 assert.equal(guidanced?.price.status,"NOT_MEASURED");
});

test("all seven dated issuer investigations open with a different short brief above their unchanged source detail",()=>{
 assert.equal(EARNINGS_CASES.length,7);
 const distinct=new Set<string>();
 for(const c of EARNINGS_CASES){
  assert.ok(c.quickBrief.length>=85&&c.quickBrief.length<=490,c.ticker);
  assert.ok(!distinct.has(c.quickBrief),c.ticker);
  distinct.add(c.quickBrief);
 }
 const full=src("components/blue-desk/EarningsInvestorDeepDive.tsx");
 assert.ok(full.indexOf("data-quick-market-brief")<full.indexOf("chaptersNav"));
 assert.match(full,/item\.quickBrief/);
 assert.match(full,/item\.metrics\.map/);
 assert.match(full,/item\.primary\.map/);
 const css=src("components/blue-desk/EarningsInvestorDeepDive.module.css");
 assert.match(css,/\.quickBrief\{/);
 assert.match(css,/@media\(max-width:680px\)/);
});

test("new verified reports show evidence boundaries; reviewed earnings keep detailed original-versus-expected discussion",()=>{
 const wire=src("components/blue-desk/BluebellyNewsWire.tsx");
 assert.match(wire,/SourceOnlyConsequence/);
 assert.match(wire,/data-market-consequence="source-only-evidence-status"/);
 assert.match(wire,/consequenceForSourceOnlyNews\(news\)/);
 const reader=src("components/blue-desk/ShortNewsRecap.tsx");
 assert.match(reader,/data-quick-market-brief="source-only"/);
 assert.match(reader,/consequenceForEarnings\(recap\.earnings,reaction\)/);
 assert.match(reader,/data-market-consequence="separate-business-price-evidence"/);
 assert.match(reader,/reaction\.extendedChangePct/);
 assert.match(reader,/REACTION_ANALYSIS_INCOMPLETE/);
 assert.match(reader,/source-only-depth-incomplete/);
});
