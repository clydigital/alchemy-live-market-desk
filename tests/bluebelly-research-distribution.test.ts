import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {routeResearchDistribution,type DistributionRow} from "../lib/bluebelly-research-distribution.ts";
import type {CreatorDigest} from "../lib/bluebelly-creator-signals.ts";
const now=new Date("2026-11-25T07:00:00Z");
const row:DistributionRow={id:"1",publisher:"MeetKevin",external_id:"6K4aaQQ3fIY",title:"Credit risk",url:"https://www.youtube.com/watch?v=6K4aaQQ3fIY",published_at:"2026-11-24T16:52:18Z",updated_at:"2026-11-25T06:00:00Z",transcript_interpreted_at:"2026-11-24T18:00:00Z",transcript_status:"ready",video_review_status:"reviewed",summary:"credit default swaps and defensive rotation",recontextualized_summary:"Gold and Nasdaq stress",affected_story_slugs:["ai-financing-stress","market-breadth-health"],transcript_metadata:{manual_sweep_review_date:"2026-11-25"},transcript_evidence_id:null};
const digest:CreatorDigest={version:"creator-signals-v1",generatedAt:"2026-11-24T23:22:00Z",marketSession:"2026-11-23",coverage:"partial",overview:{headline:"h",news:[],signals:[],divergences:[]},creators:[{publisher:row.publisher,videoId:row.external_id,title:row.title,publishedAt:row.published_at,sourceStatus:"reviewed",news:[],views:[],fundamentals:[],opinions:[],changed:"none"}]};
test("recent review routes to relevant destinations without claiming delivery",()=>{
 const r=routeResearchDistribution([row],digest,now);
 assert.equal(r.items[0].digestState,"SOURCE_NEWER_THAN_DIGEST");
 for(const key of ["creator","dashboard","ai","bonds","breadth","compare","divergence","crash","gold","positioning"])assert.ok(r.targets.some(t=>t.destination===key),key);
 assert.ok(!r.targets.some(t=>t.destination==="housing"));
 assert.ok(r.targets.every(t=>t.status==="ANALYST_HANDOFF_REQUIRED"));
});
test("supplied transcript and description preserve provenance and unknown publication time",()=>{
 const manual={...row,external_id:null,transcript_status:"missing",video_review_status:"transcript_only",transcript_metadata:{manual_sweep_source:"user_pasted_transcript",published_at_is_capture_proxy:true}};
 const partial={...row,id:"2",transcript_status:"missing",video_review_status:"unavailable",transcript_metadata:{source_scope:"video_description_only",publication_time_unknown:true}};
 const r=routeResearchDistribution([manual,partial],null,now,true);
 assert.equal(r.coverage,"BOUNDED_PARTIAL");
 assert.equal(r.items[0].sourceState,"SUPPLIED_ARGUMENT");
 assert.equal(r.items[1].sourceState,"DESCRIPTION_ONLY");
 assert.ok(r.items.every(i=>i.publishedAt===null&&i.digestState==="DIGEST_UNAVAILABLE"));
});
test("digest source membership is not proof of content or publication",()=>{
 const r=routeResearchDistribution([row],{...digest,generatedAt:"2026-11-25T06:30:00Z"},now);
 assert.equal(r.items[0].digestState,"SOURCE_LISTED_CONTENT_UNVERIFIED");
 assert.equal(r.targets.find(t=>t.destination==="creator")?.status,"SOURCE_LISTED_CONTENT_UNVERIFIED");
 assert.equal(r.targets.find(t=>t.destination==="ai")?.status,"ANALYST_HANDOFF_REQUIRED");
});
test("routing is exposed only after existing owner authentication, no mutation",()=>{
 const route=readFileSync(new URL("../app/api/owner/daily-research/route.ts",import.meta.url),"utf8");
 const server=readFileSync(new URL("../lib/bluebelly-research-distribution-server.ts",import.meta.url),"utf8");
 assert.ok(route.indexOf("await getOwnerResearchDistribution")>route.indexOf('if(accessError||!access)'));
 assert.match(server,/import "server-only"/);
 assert.doesNotMatch(server,/\.insert\(|\.upsert\(|\.update\(/);
});
