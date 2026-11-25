import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildEvidenceGemCandidates} from "../lib/bluebelly-evidence-gems.ts";
const now=new Date("2026-11-26T07:00:00Z");
const news={contractVersion:"news-brief/1" as const,contentType:"NEWS_BRIEF" as const,id:"one",headline:"Employment release",summary:"Actual reporting",sourceName:"Official",sourceUrl:"https://example.com/release",sourceKind:"official",occurredAt:"2026-11-25T12:00:00Z",observedAt:"2026-11-25T12:30:00Z",verification:"SOURCE_VERIFIED" as const};
const stat={id:"yield",symbol:"US2Y",label:"2-year",type:"Rates" as const,last:4.5,change:-7.5,change3d:null,change5d:null,changeUnit:"bp" as const,frequency:"daily" as const,asOf:"2026-11-25",sourceName:"Treasury",sourceUrl:"https://example.com/yield"};
const v={publisher:"MeetKevin",videoId:"SecQgkVR1sU",title:"Conditional logic",url:"https://www.youtube.com/watch?v=SecQgkVR1sU",publishedAt:"2026-11-25T13:00:00Z",summary:"A forecast",logic:"IF yields fall AND demand holds THEN housing may benefit UNLESS credit stress rises",claimChecks:[{kind:"creator_claim",claim:"Unverified release claim",verificationTarget:"Original release"}]};
const input={now,news:[news,{...news,id:"two",sourceUrl:news.sourceUrl+"?utm_source=other"}],marketObservations:[stat,{...stat,id:"future",asOf:"2026-11-27"},{...stat,id:"stale",symbol:"OLD",dataStatus:"UNAVAILABLE_OR_STALE" as const}],creatorReviews:[v],creatorCoverage:"AVAILABLE" as const,notion:{status:"PARTIAL" as const,sources:[],warnings:[],fetchedAt:now.toISOString()},calendar:[{title:"Next payrolls",scheduledAt:"2026-12-04",sourceUrl:"https://example.com/payrolls",sourceName:"BLS",verificationState:"scheduled",decidingQuestion:"Did hiring weaken?"}]};
test("evidence gems dedupe exact original news and preserve separate attributed and scheduled states",()=>{
 const out=buildEvidenceGemCandidates(input);
 assert.equal(out.candidates.filter(c=>c.kind==="NEWS").length,1);
 assert.equal(out.candidates.filter(c=>c.kind==="STATISTIC").length,1);
 assert.equal(out.candidates.find(c=>c.kind==="STATISTIC")?.metric?.change1d,-7.5);
 assert.equal(out.candidates.find(c=>c.kind==="STATISTIC")?.metric?.changeUnit,"bp");
 assert.equal(out.candidates.find(c=>c.kind==="STATISTIC")?.state,"SOURCE_DATED_NOT_FRESHNESS_VERIFIED");
 assert.ok(out.candidates.filter(c=>c.kind==="TRANSCRIPT_ARGUMENT").every(c=>c.state==="ATTRIBUTED"));
 assert.equal(out.candidates.find(c=>c.kind==="SCHEDULED_EVENT")?.state,"SCHEDULED_NOT_ACTUAL");
 assert.equal(out.coverage.notion,"PARTIAL");
});
test("owner route builds candidate pool only after existing allowlist and does not write or fetch another feed",()=>{
 const route=readFileSync(new URL("../app/api/owner/daily-research/route.ts",import.meta.url),"utf8");
 assert.ok(route.indexOf("const evidenceGemCandidates=buildEvidenceGemCandidates")>route.indexOf("if(accessError||!access)"));
 const code=readFileSync(new URL("../lib/bluebelly-evidence-gems.ts",import.meta.url),"utf8");
 assert.doesNotMatch(code,/\bfetch\(|\.insert\(|\.upsert\(|\.update\(/);
});
test("transcript reviewer uses conditional premises and arithmetic guardrails in existing call budget",()=>{
 const code=readFileSync(new URL("../lib/transcript-research-review.ts",import.meta.url),"utf8");
 assert.match(code,/IF \[measurable premises\] AND \[conditions\] THEN/);
 assert.match(code,/Recalculate consequential arithmetic/);
 assert.match(code,/maxOutputTokens: 3_200/);
 assert.match(code,/maxAttempts: 1/);
});
