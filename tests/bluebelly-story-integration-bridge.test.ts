import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {projectFrozenTrackedStories} from "../lib/blue-desk-tracked-stories.ts";
import {blueDeskHostAccess,blueDeskPresentationTarget} from "../lib/blue-desk-host.ts";
const id=(n:number)=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const src=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
function fixture(){
 return {id:id(900),published_at:"2026-10-25T04:00:00.000Z",payload:{
  canonicalStoryManifest:[],stories:[],
  presenterDossierContext:{dossierAsOf:"2026-10-24T18:00:00.000Z"},
  dossier:{lessons:[1,2,3,4,5,6].map(n=>({
   storyId:id(n),thesisVersionId:id(100+n),publicationSnapshotId:id(200+n),
   question:"Original standing Story question "+n,
   currentAttention:{assessedAt:"2026-10-24T17:00:00.000Z"},
   callouts:[{type:"commentary_context",label:"RECENT CONTEXT — NO MATERIAL CHANGE"}],
   evidenceRefs:[id(300+n)],
   watchItems:[{variable:"Verify primary-source condition "+n}],
  }))}
 }};
}
test("integrated old Story identities never impersonate accepted current thesis changes",()=>{
 const t=projectFrozenTrackedStories(fixture());
 assert.ok(t);
 assert.equal(t?.tracks.length,6);
 assert.equal(t?.currentAcceptedStoryCount,0);
 assert.ok(t?.tracks.every(x=>x.status==="CARRIED_FORWARD_NO_ACCEPTED_CHANGE"));
 assert.ok(t?.tracks.every(x=>x.historicalSnapshotId!==t.editionId));
 assert.ok(t?.tracks.every(x=>x.assessedAt==="2026-10-24T17:00:00.000Z"));
 assert.deepEqual(t?.tracks.map(x=>x.storyId),[1,2,3,4,5,6].map(id));
});
test("historical projection fails closed on wrong or future Dossier clock, invalid identities or missing carry-forward marker",()=>{
 const f=fixture();
 f.payload.presenterDossierContext.dossierAsOf="2026-10-26T00:00:00.000Z";
 assert.equal(projectFrozenTrackedStories(f)?.tracks.length,0);
 f.payload.presenterDossierContext.dossierAsOf="2026-10-24T18:00:00.000Z";
 f.payload.dossier.lessons[0].callouts=[];
 f.payload.dossier.lessons[1].thesisVersionId="not-a-uuid";
 assert.equal(projectFrozenTrackedStories(f)?.tracks.length,4);
 assert.equal(projectFrozenTrackedStories({...f,id:"INVALID"}),null);
});
test("key-stories coexist: accepted readings, carried historical questions, and independently verified new facts remain separate",()=>{
 const body=src("app/blue-desk/key-stories/page.tsx");
 assert.match(body,/projectFrozenTrackedStories\(edition\)/);
 assert.match(body,/getTrackedOriginalSources\(tracker\)/);
 assert.match(body,/data-bluebelly-tracked-stories="frozen-context"/);
 assert.match(body,/No new accepted Story change/);
 assert.match(body,/thread\.thesisVersionId/);
 assert.match(body,/thread\.evidenceReferenceCount/);
 assert.match(body,/No historical original source passed the time and provenance/);
 assert.match(body,/Published analysis/);
 assert.match(body,/brief\.articles\.filter/);
 assert.match(body,/Fresh verified developments/);
 assert.match(body,/selectVerifiedNewsBriefs\(raw, new Date\(\), 6\)/);
 assert.match(body,/SOURCE-VERIFIED FACT · NOT STORY EVIDENCE/);
 assert.doesNotMatch(body,/createSupabaseAdminClient|createSupabaseServerClient|generateContent|story_thesis_versions/);
});
test("tracked evidence read is time-bounded and original-source restricted",()=>{
 const source=src("lib/blue-desk-tracked-evidence.ts");
 for(const fragment of ['created>asOf','available>asOf','source_tier>2','if(u.protocol!=="https:"','limit(100)','CLASSES.has','available_at'])assert.ok(source.includes(fragment),fragment);
 assert.doesNotMatch(source,/\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
});
test("keep exact /key-stories public rewrite and separate /rates, /what-changed pages",()=>{
 const nav=src("components/blue-desk/BlueDeskHeader.tsx");
 assert.match(nav,/\["Rates", "\/rates"\]/);
 assert.match(nav,/\["What Changed", "\/what-changed"\]/);
 assert.doesNotMatch(nav,/\["Rates", "\/#rates-title"\]/);
 assert.doesNotMatch(nav,/\["What Changed", "\/#motion-title"\]/);
 for(const p of ["/key-stories","/rates","/what-changed"]){
  assert.equal(blueDeskHostAccess(p,"bluebelly-desk.vercel.app"),"public");
  assert.equal(blueDeskPresentationTarget(p,"bluebelly-desk.vercel.app"),"/blue-desk"+p);
 }
});
