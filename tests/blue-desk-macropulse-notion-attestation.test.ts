import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {attestMacroPulseNotionSource} from "../lib/blue-desk-macropulse-notion-attestation.ts";
import type {MacroPulseDigest} from "../lib/blue-desk-macropulse-brief.ts";

const pageId="405519b6-7a94-812d-bc66-ebb8217596dc";
const archiveId="405519b6-7a94-8190-9099-f538857705e6";
const root="3ea519b6-7a94-8161-ba4d-ec8f97ebf658";
const pulseId="2026-10-27-0600-broadcom-anthropic-financing-hormuz-brazil-close";
const issuerUrl="https://investors.broadcom.com/news-releases/news-release-details/bank-america-blackstone-citi-and-morgan-stanley-announce";
const now=()=>new Date("2026-10-26T23:00:00.000Z");
const digest={
 contractVersion:"bluebelly/macropulse-brief/1",
 sourcePageId:pageId,sourcePulseId:pulseId,
 sourcePageUrl:"https://app.notion.com/p/405519b67a94812dbc66ebb8217596dc",
 sourcePublishedAt:"2026-10-26T22:00:00Z",
 sourceRetrievedAt:"2026-10-26T22:55:17Z",
 sourceLinks:[{url:issuerUrl,label:"Broadcom original release",kind:"PRIMARY_RELEASE"}],
} as MacroPulseDigest;
type Fixture={wrongRoot?:boolean;wrongPulse?:boolean;missingLink?:boolean;futureCreated?:boolean;more?:boolean;denied?:boolean};
function fakeNotion(o:Fixture={}){
 const calls:string[]=[];
 const fetcher=(async(url:RequestInfo|URL,init?:RequestInit)=>{
  const path=String(url);
  calls.push(path);
  assert.ok(path.startsWith("https://api.notion.com/v1/"));
  assert.equal(init?.method,"GET");
  assert.equal(init?.cache,"no-store");
  assert.equal(new Headers(init?.headers).get("Notion-Version"),"2025-09-03");
  assert.equal(new Headers(init?.headers).get("Authorization"),"Bearer "+"s".repeat(36));
  if(o.denied)return new Response("{}",{status:403});
  if(path.endsWith("/pages/"+pageId)){
   return Response.json({id:pageId,parent:{type:"page_id",page_id:archiveId},
    created_time:o.futureCreated?"2026-10-28T22:09:00.000Z":"2026-10-26T22:09:00.000Z",
    last_edited_time:o.futureCreated?"2026-10-28T22:09:00.000Z":"2026-10-26T22:09:00.000Z",
    archived:false,in_trash:false});
  }
  if(path.endsWith("/pages/"+archiveId.replaceAll("-",""))){
   return Response.json({id:archiveId,parent:{type:"page_id",
    page_id:o.wrongRoot?"ffffffff-ffff-ffff-ffff-ffffffffffff":root},
    properties:{title:{type:"title",title:[{plain_text:"2026-10-27 — MacroPulse"}]}},
    archived:false,in_trash:false});
  }
  if(path.includes("/blocks/"+pageId+"/children")){
   return Response.json({results:[
    {type:"callout",callout:{rich_text:[{plain_text:
      "06:00 MYT | Pulse ID: "+(o.wrongPulse?"fake-pulse-id":pulseId)}]}},
    {type:"paragraph",paragraph:{rich_text:[{
      plain_text:"Primary Broadcom release",
      href:o.missingLink?"https://example.org/wrong-original":issuerUrl
    }]}},
   ],has_more:!!o.more,next_cursor:o.more?"cursor-test":null});
  }
  throw Error("Unexpected Notion request: "+path);
 }) as typeof fetch;
 return {fetcher,calls};
}
test("native page creation clock wins over declared scheduled slot; exact original source required",async()=>{
 const {fetcher,calls}=fakeNotion();
 const proof=await attestMacroPulseNotionSource(digest,"s".repeat(36),fetcher,now);
 assert.deepEqual(proof,{sourceCreatedAt:"2026-10-26T22:09:00.000Z",
  sourceLastEditedAt:"2026-10-26T22:09:00.000Z",
  retrievedAt:"2026-10-26T23:00:00.000Z"});
 assert.equal(calls.length,3);
});
test("reject source parent outside the authorised MacroPulse archive",async()=>{
 const x=fakeNotion({wrongRoot:true});
 assert.equal(await attestMacroPulseNotionSource(digest,"s".repeat(36),x.fetcher,now),null);
});
test("reject Pulse ID absent from full original and forged cited link",async()=>{
 for(const o of [{wrongPulse:true},{missingLink:true}]){
  const x=fakeNotion(o);
  assert.equal(await attestMacroPulseNotionSource(digest,"s".repeat(36),x.fetcher,now),null);
 }
});
test("reject future source dates, incomplete pagination and unscoped token",async()=>{
 for(const o of [{futureCreated:true},{more:true}]){
  const x=fakeNotion(o);
  assert.equal(await attestMacroPulseNotionSource(digest,"s".repeat(36),x.fetcher,now),null);
 }
 const x=fakeNotion();
 assert.equal(await attestMacroPulseNotionSource(digest,"short",x.fetcher,now),null);
 assert.equal(x.calls.length,0);
});
test("provider HTTP failure is not a valid source-attestation receipt",async()=>{
 const x=fakeNotion({denied:true});
 await assert.rejects(()=>attestMacroPulseNotionSource(digest,"s".repeat(36),x.fetcher,now));
});
test("existing private route retains review-only receiver and accepts optional attestation without another scheduler",()=>{
 const route=readFileSync(new URL("../app/api/internal/bluebelly-editorial/route.ts",import.meta.url),"utf8");
 assert.match(route,/NOTION_SOURCE_ATTESTED/);
 assert.match(route,/BLUEBELLY_NOTION_RESEARCH_TOKEN/);
 assert.match(route,/BLUEBELLY_REQUIRE_NOTION_ATTESTATION/);
 assert.match(route,/attestMacroPulseNotionSource\(parsed,readToken\)/);
 assert.match(route,/status:"review"/);
 assert.match(route,/sourcePublishedAt:attested.sourceCreatedAt/);
 assert.doesNotMatch(route,/story_thesis_versions|market_motion_items|publish\(/);
});
