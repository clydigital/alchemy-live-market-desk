import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {blueDeskHostAccess,blueDeskPresentationTarget} from "../lib/blue-desk-host.ts";
import {parseBluebellyExactPrepQuery} from "../lib/bluebelly-exact-prep-query.ts";
import {resolvePresenterPrepExactSelection} from "../lib/presenter-prep-exact-edition.ts";
import type {EditionSnapshot} from "../lib/edition-replay.ts";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const id=(n:number)=>"00000000-0000-4000-8000-"+n.toString(16).padStart(12,"0");
function edition(n:number,supersedes:string|null=null):EditionSnapshot {
 const date=new Date(Date.UTC(2026,7,1+n,2,0)).toISOString();
 return {id:id(n),snapshot_type:"daily_brief",research_run_id:id(100+n),
  published_at:date,supersedes_snapshot_id:supersedes,
  payload:{scheduleSlot:"morning",scheduledFor:date}};
}
test("only one exact Bluebelly Presenter editions route can pass private auth",()=>{
 const host="bluebelly-desk.vercel.app";
 assert.equal(blueDeskHostAccess("/owner/presenter/editions",host),"private");
 assert.equal(blueDeskPresentationTarget("/owner/presenter/editions",host),null);
 for(const path of ["/owner/presenter/editions/","/owner/presenter/editions/raw",
  "/presenter/full-prep","/api/presenter/editions","/blue-desk/presenter/full-prep"]){
  assert.equal(blueDeskHostAccess(path,host),"blocked",path);
 }
 const middleware=read("middleware.ts");
 assert.match(middleware,/supabase\.auth\.getClaims\(\)/);
 assert.match(middleware,/app_access_allowlist/);
 const presenter=read("app/owner/presenter/page.tsx");
 assert.match(presenter,/href="\/owner\/presenter\/editions"/);
});
test("a bare URL is a picker; missing or malicious focus/edition is invalid",()=>{
 assert.deepEqual(parseBluebellyExactPrepQuery({}),{state:"picker"});
 const invalid=[{story:"rates"},{edition:"current"},{edition:id(1),event:["a","b"]},
  {edition:id(1),foo:"bar"},{edition:id(1),motion:"\nattack"}];
 for(const query of invalid)assert.equal(parseBluebellyExactPrepQuery(query).state,"invalid");
 assert.deepEqual(parseBluebellyExactPrepQuery({edition:id(5),story:"rates"}),{
  state:"exact",editionId:id(5),focus:{story:"rates"},
 });
});
test("older-than-24 archives still resolve exactly, and exact current stays current",()=>{
 const full=Array.from({length:28},(_,i)=>edition(i+1));
 const recent=full.slice(-24).reverse();
 const past=resolvePresenterPrepExactSelection({
  recent,requestedEditionId:full[0].id,exactEdition:full[0],directSuperseders:[],
 });
 assert.equal(past.status,"historical");
 assert.equal(past.selectedSnapshot?.id,full[0].id);
 const current=resolvePresenterPrepExactSelection({
  recent,requestedEditionId:recent[0].id,exactEdition:recent[0],directSuperseders:[],
 });
 assert.equal(current.status,"current");
 assert.equal(current.selectedSnapshot?.id,current.current?.snapshotId);
});
test("invalid or unverified successor probe never supplies today's publication",()=>{
 const a=edition(1),b=edition(2);
 const bad=[
  {requestedEditionId:id(9),exactEdition:null,directSuperseders:[]},
  {requestedEditionId:id(9),exactEdition:b,directSuperseders:[]},
  {requestedEditionId:a.id,exactEdition:a,directSuperseders:null},
  {requestedEditionId:a.id,exactEdition:a,
   directSuperseders:[{...b,supersedes_snapshot_id:id(888)}]},
 ];
 for(const opts of bad){
  const result=resolvePresenterPrepExactSelection({recent:[b,a],...opts});
  assert.equal(result.status,"invalid_fallback_current");
  assert.equal(result.selectedSnapshot,null);
 }
});
test("real historical page uses exact frozen Dossier and never a mutable Story writer",()=>{
 const page=read("app/owner/presenter/editions/page.tsx");
 const reader=read("lib/presenter-prep-direct-superseders.ts");
 assert.match(page,/getHybridExactDailyBriefEdition\(requested\.editionId\)/);
 assert.match(page,/getPresenterDirectDailyBriefSuperseders\(requested\.editionId\)/);
 assert.match(page,/getDossierV2PresentationSelectionById\(frozen\.dossierId\)/);
 assert.match(page,/dossier\.selectedDossierId===frozen\?\.dossierId/);
 assert.match(page,/dossier\.selectedAsOf===frozen\?\.dossierAsOf/);
 assert.match(page,/buildPresenterPrepSourceProjection/);
 assert.match(page,/buildPresenterPrepEditorialReadiness/);
 assert.match(page,/PresenterPrepSession editionId=\{pinned\.editionId\} dossierId=\{pinned\.dossierId\}/);
 assert.match(page,/source\.status!=="READY"/);
 assert.match(page,/if\(requested\.state==="invalid"\)notFound\(\)/);
 assert.doesNotMatch(page,/generateContent|story_thesis_versions|latestStoryThesis|createSupabaseAdminClient/);
 assert.match(reader,/getPresenterDirectDailyBriefSuperseders/);
 assert.match(reader,/data\.length>=25/);
 assert.match(reader,/return null/);
 assert.doesNotMatch(reader,/insert\(|update\(|upsert\(|\.rpc\(/);
});
