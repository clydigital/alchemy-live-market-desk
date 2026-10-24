import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { projectFrozenTrackedStories } from "../lib/blue-desk-tracked-stories.ts";
import { blueDeskHostAccess,blueDeskPresentationTarget } from "../lib/blue-desk-host.ts";

const uuid=(n:number)=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const QUESTIONS=[
"Why is AI capex cash conversion weaker than guidance?",
"Why are long-end US yields holding elevated?",
"Why did China-sensitive tech lag despite headlines?",
"Can diesel scarcity sustain inflation pressure?",
"Is crude backwardation evidence of physical tightness?",
"Why did Treasuries rally during the CPI equities selloff?",
];
function fixture(){
 return {
  id:uuid(900),published_at:"2026-10-24T14:41:28.839Z",
  payload:{
   stories:[],canonicalStoryManifest:[],
   presenterDossierContext:{dossierAsOf:"2026-10-23T15:05:32.442Z"},
   dossier:{lessons:QUESTIONS.map((question,i)=>({
     storyId:uuid(i+1),thesisVersionId:uuid(i+101),
     publicationSnapshotId:uuid(i+201),
     question,currentAttention:{assessedAt:"2026-10-23T14:40:52.520Z",state:"recent_context"},
     callouts:[{type:"commentary_context",label:"RECENT CONTEXT — NO MATERIAL CHANGE"}],
     evidenceRefs:[uuid(i+301)],
     watchItems:[{variable:"Review primary original source for "+String(i+1)}],
   }))},
  },
 };
}

test("six distinct prior Story identities remain visible even when current stories and manifest are empty",()=>{
 const v=projectFrozenTrackedStories(fixture());
 assert.equal(v?.currentAcceptedStoryCount,0);
 assert.equal(v?.tracks.length,6);
 assert.deepEqual(v?.tracks.map(x=>x.question),QUESTIONS);
 assert.equal(v?.tracks[0].status,"CARRIED_FORWARD_NO_ACCEPTED_CHANGE");
 assert.equal(v?.tracks[0].evidenceReferenceCount,1);
 assert.equal(v?.tracks[0].assessedAt,"2026-10-23T14:40:52.520Z");
 assert.equal(v?.dossierAsOf,"2026-10-23T15:05:32.442Z");
 assert.notEqual(v?.tracks[0].historicalSnapshotId,v?.editionId);
});

test("fail closed on unversioned, fake, duplicate, future or unsupported Story context",()=>{
 const a=fixture();
 const l=a.payload.dossier.lessons;
 l.push({...l[0]!,question:"Copied title"});
 l.push({...l[0]!,storyId:uuid(22),thesisVersionId:"wrong"});
 l.push({...l[0]!,storyId:uuid(23),callouts:[]});
 l.push({...l[0]!,storyId:uuid(24),question:""});
 l.push({...l[0]!,storyId:uuid(25),currentAttention:{assessedAt:"2026-10-26T00:00:00Z",state:"recent_context"}});
 const b=projectFrozenTrackedStories(a);
 assert.equal(b?.tracks.length,7);
 assert.equal(b?.tracks.find(x=>x.storyId===uuid(25))?.assessedAt,null);
 a.payload.presenterDossierContext.dossierAsOf="2026-10-26T00:00:00Z";
 assert.deepEqual(projectFrozenTrackedStories(a)?.tracks,[]);
 assert.equal(projectFrozenTrackedStories({...a,id:"invalid"}),null);
 assert.equal(projectFrozenTrackedStories(null),null);
});

test("publisher preserves published-only and historical watch as distinct user-facing sections",()=>{
 const page=readFileSync(new URL("../app/blue-desk/page.tsx",import.meta.url),"utf8");
 const expanded=readFileSync(new URL("../app/blue-desk/key-stories/page.tsx",import.meta.url),"utf8");
 assert.match(page,/projectFrozenTrackedStories\(latest\)/);
 assert.match(page,/data-public-tracked-stories="true"/);
 assert.match(page,/className=\{tracked\.grid\}/);
 assert.match(page,/className=\{tracked\.card\}/);
 const grid=readFileSync(new URL("../app/blue-desk/tracked-stories.module.css",import.meta.url),"utf8");
 assert.match(grid,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(grid,/@media\(max-width:1080px\)/);
 assert.match(grid,/@media\(max-width:690px\)/);
 assert.match(page,/No material thesis update is claimed/);
 assert.match(page,/key-stories",host\)\+"#story-"/);
 assert.match(expanded,/Published analysis/);
 assert.match(expanded,/Ongoing Story watch/);
 assert.match(expanded,/no accepted material change/);
 assert.match(expanded,/No new accepted Story change/);
 assert.match(expanded,/currentAcceptedStoryCount/);
 assert.match(expanded,/evidenceReferenceCount/);
 const sources=readFileSync(new URL("../lib/blue-desk-tracked-evidence.ts",import.meta.url),"utf8");
 assert.doesNotMatch(sources,/claim_text|claimExcerpt/);
 assert.match(sources,/const allowed=\["sec\.gov"/);
 assert.match(sources,/source_tier>2/);
 assert.match(sources,/created>asOf\|\|available>asOf/);
 assert.doesNotMatch(expanded,/source\.claimExcerpt/);
 assert.doesNotMatch(expanded,/\.from\("story_thesis_versions"\)|createSupabaseAdminClient|generateContent/);
 assert.equal(blueDeskHostAccess("/key-stories","bluebelly-desk.vercel.app"),"public");
 assert.equal(blueDeskPresentationTarget("/key-stories","bluebelly-desk.vercel.app"),"/blue-desk/key-stories");
});
