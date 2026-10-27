import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import type {ResearchRunInput} from "../lib/research-update.ts";
import {applyMaterialSecProspectusIntake,etAcceptedToUtc,PRIORITY_EDGAR_ISSUERS} from "../lib/material-sec-prospectus-intake.ts";
import {buildMarketMotionCandidates} from "../lib/market-motion-ingestion.ts";

const now=new Date("2026-10-27T08:00:00.000Z");
const ua="Bluebelly Filing Research desk-ops@example.org";
const submissionsUrl="https://data.sec.gov/submissions/CIK0002130357.json";
const accession="0001628280-26-067168";
const filingUrl="https://www.sec.gov/Archives/edgar/data/2130357/000162828026067168/0001628280-26-067168-index.htm";
const payload={
 cik:2130357,name:"Anthropic, PBC",
 filings:{recent:{accessionNumber:[accession],filingDate:["2026-10-26"],
  reportDate:[""],acceptanceDateTime:["20261026090011"],form:["S-1"],
  primaryDocument:["anthropicpbc-sx1.htm"],items:[""]}}
};
const init=():ResearchRunInput=>({runKey:"test-EDGAR",scheduleSlot:"morning",
 scheduledFor:now.toISOString(),sourceChecks:[],items:[],summary:"Existing source intake."});
const original=()=>new Response("<html><h1>Filing Detail</h1><p>Form S-1 - General form</p><p>SEC Accession No. "+accession+"</p></html>",{headers:{"content-type":"text/html"}});
function mock(overrides:{payload?:unknown;index?:Response;http?:number}={}){
 const seen:string[]=[];
 const fetchImpl=(async (target:RequestInfo|URL)=>{
  const u=String(target);seen.push(u);
  if(u===submissionsUrl)return overrides.http?new Response("",{status:overrides.http}):Response.json(overrides.payload??payload);
  if(u===filingUrl)return overrides.index||original();
  return new Response("Not Found",{status:404});
 }) as typeof fetch;
 return {fetchImpl,seen};
}
test("US Eastern accepted clock converts correctly including October DST and December standard time",()=>{
 assert.equal(etAcceptedToUtc("20261026090011"),"2026-10-26T13:00:11.000Z");
 assert.equal(etAcceptedToUtc("20261226090011"),"2026-12-26T14:00:11.000Z");
 assert.equal(etAcceptedToUtc("20261032090011"),null);
 assert.equal(etAcceptedToUtc("202610260900"),null);
 assert.equal(etAcceptedToUtc(null),null);
});
test("original SEC submission and exact HTML accession qualifies Anthropic S-1 as factual filing Motion",async()=>{
 const m=mock();
 const out=await applyMaterialSecProspectusIntake(init(),{now,userAgent:ua,fetchImpl:m.fetchImpl});
 assert.equal(out.items.length,1);
 assert.equal(out.items[0].url,filingUrl);
 assert.equal(out.items[0].publishedAt,"2026-10-26T13:00:11.000Z");
 assert.equal(out.items[0].title,"Anthropic, PBC filed Form S-1 with the SEC");
 assert.equal(out.items[0].evidence?.[0]?.claim,out.items[0].title);
 assert.match(out.items[0].reviewReason||"",/NOT verified/);
 assert.match(out.summary||"",/new=1/);
 assert.ok(m.seen.includes(submissionsUrl));
 assert.ok(m.seen.includes(filingUrl));
 assert.ok(m.seen.length<=PRIORITY_EDGAR_ISSUERS.length+1);
 const motions=buildMarketMotionCandidates(out.items.map(i=>({...i,candidateScore:94,evidence:i.evidence||[]})),[],{now});
 assert.equal(motions.length,1);
 assert.equal(motions[0].sourceKind,"filing");
 assert.equal(motions[0].verificationState,"VERIFIED");
 assert.equal(motions[0].marketReaction,null,"No fabricated IPO market price");
});
test("missing SEC contact, future acceptance, stale form, wrong company, denied HTML and unrelated 10-K fail closed",async()=>{
 const cases=[
 {opts:{userAgent:""},variant:{}},
 {opts:{userAgent:ua,now:new Date("2026-10-26T12:00:00Z")},variant:{}},
 {opts:{userAgent:ua,now:new Date("2026-11-10T12:00:00Z")},variant:{}},
 {opts:{userAgent:ua},variant:{payload:{...payload,cik:1111111}}},
 {opts:{userAgent:ua},variant:{payload:{...payload,filings:{recent:{...payload.filings.recent,form:["10-K"]}}}}},
 {opts:{userAgent:ua},variant:{index:new Response("<html><h1>Other filing</h1></html>",{headers:{"content-type":"text/html"}})}},
 {opts:{userAgent:ua},variant:{http:403}}
 ];
 for(const {opts,variant} of cases){
  const result=await applyMaterialSecProspectusIntake(init(),{now,...opts,fetchImpl:mock(variant).fetchImpl});
  assert.equal(result.items.length,0);
 }
});
test("exact filing URL deduplicates and uses only the existing research schedule",async()=>{
 const seen=mock();
 const first=await applyMaterialSecProspectusIntake(init(),{now,userAgent:ua,fetchImpl:seen.fetchImpl});
 const again=await applyMaterialSecProspectusIntake(first,{now,userAgent:ua,fetchImpl:seen.fetchImpl});
 assert.equal(again.items.length,1);
 assert.equal(PRIORITY_EDGAR_ISSUERS.length,5);
 const scheduled=readFileSync(new URL("../lib/firecrawl-scheduled-research.ts",import.meta.url),"utf8");
 const vercel=readFileSync(new URL("../vercel.json",import.meta.url),"utf8");
 assert.ok(scheduled.indexOf("applyOfficialPressNewsIntake(input, { now })") <
   scheduled.indexOf("applyMaterialSecProspectusIntake(originalSourceInput, { now })"));
 assert.ok(scheduled.indexOf("applyMaterialSecProspectusIntake(originalSourceInput, { now })") <
   scheduled.indexOf("applyResearchDiscoveryProviders(discoveryInput"));
 assert.doesNotMatch(vercel,/material-sec-prospectus-intake/);
});

test("original Tesla 8-K with material agreement code becomes factual filing, not a confirmed merger",async()=>{
 const acc="0001628280-26-067169";
 const meta={cik:1318605,name:"Tesla, Inc.",
  filings:{recent:{accessionNumber:[acc],filingDate:["2026-10-26"],reportDate:[""],
   acceptanceDateTime:["20261026105501"],form:["8-K"],
   primaryDocument:["tsla-8k.htm"],items:["1.01, 9.01"]}}};
 const url="https://www.sec.gov/Archives/edgar/data/1318605/000162828026067169/"+acc+"-index.htm";
 const fetchImpl=(async(u:RequestInfo|URL)=>{
  if(String(u)==="https://data.sec.gov/submissions/CIK0001318605.json")
   return Response.json(meta);
  if(String(u)===url)return new Response("<html><h1>Filing Detail</h1><p>SEC Accession "+acc+"</p><p>Form 8-K</p></html>",{headers:{"content-type":"text/html"}});
  return new Response("",{status:404});
 }) as typeof fetch;
 const out=await applyMaterialSecProspectusIntake(init(),{now,userAgent:ua,fetchImpl});
 assert.equal(out.items.length,1);
 assert.match(out.items[0].title,/Tesla, Inc. filed Form 8-K.*1.01/);
 assert.match(out.items[0].newsSignal||"",/completion.*NOT established/i);
 assert.match(out.items[0].reviewReason||"",/NOT verified/i);
 const motion=buildMarketMotionCandidates(out.items.map(i=>({...i,candidateScore:94,evidence:i.evidence||[]})),[],{now});
 assert.equal(motion[0].verificationState,"VERIFIED","Only actual filing existence verified");
 assert.equal(motion[0].marketReaction,null);
});
test("routine 8-K items 2.02/9.01, spoofed issuer and mismatched accession fail closed",async()=>{
 const payload8k={cik:1318605,name:"Tesla, Inc.",
  filings:{recent:{accessionNumber:["0001628280-26-067169"],filingDate:["2026-10-26"],
   reportDate:[""],acceptanceDateTime:["20261026105501"],form:["8-K"],
   primaryDocument:["tsla-8k.htm"],items:["2.02, 9.01"]}}};
 const fetchImpl=(async(u:RequestInfo|URL)=>{
  if(String(u)==="https://data.sec.gov/submissions/CIK0001318605.json")return Response.json(payload8k);
  throw Error("No 8-K detail read allowed for nonmaterial item codes");
 }) as typeof fetch;
 const out=await applyMaterialSecProspectusIntake(init(),{now,userAgent:ua,fetchImpl});
 assert.equal(out.items.length,0);
});
