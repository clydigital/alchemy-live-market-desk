import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {EDITORIAL_REGIME_LENSES,groupPublicResearch} from "../lib/bluebelly-editorial-architecture.ts";
import {blueDeskHostAccess,blueDeskPresentationTarget,blueDeskPublicHref} from "../lib/blue-desk-host.ts";
import type {PublicThesis} from "../lib/blue-desk-thesis-ledger.ts";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const publicHosts=["bluebelly-desk.vercel.app","alchemy-live-market-desk.vercel.app"];

test("all nine research lenses have exact clean URLs on approved public hosts",()=>{
 assert.equal(EDITORIAL_REGIME_LENSES.length,9);
 for(const lens of EDITORIAL_REGIME_LENSES){
  const clean="/regime-watch/"+lens.id;
  const internal="/blue-desk"+clean;
  for(const host of publicHosts){
   assert.equal(blueDeskHostAccess(clean,host),"public",clean);
   assert.equal(blueDeskHostAccess(internal,host),"public",internal);
   assert.equal(blueDeskPresentationTarget(clean,host),internal);
   assert.equal(blueDeskPresentationTarget(internal,host),null);
   assert.equal(blueDeskPublicHref(internal,host),clean);
  }
 }
});

test("unknown, nested, encoded or owner research routes never become public lens pages",()=>{
 for(const path of [
  "/regime-watch/private","/regime-watch/admin","/regime-watch/fed/notes",
  "/regime-watch/fed/","/regime-watch/AI","/regime-watch/%2e%2e",
  "/regime-watch/%2Fowner","/blue-desk/regime-watch/internal",
  "/blue-desk/regime-watch/bonds/credentials","/api/research-gap",
 ]){
  assert.equal(blueDeskHostAccess(path,publicHosts[0]),"blocked",path);
  assert.notEqual(blueDeskHostAccess(path,publicHosts[1]),"public",path);
  assert.equal(blueDeskPresentationTarget(path,publicHosts[0]),null,path);
 }
 assert.equal(blueDeskPresentationTarget("/regime-watch/fed","preview.example.com"),null);
});

test("Regime Watch directory links to full research pages rather than expanding a details element",()=>{
 const directory=read("app/blue-desk/regime-watch/page.tsx");
 assert.match(directory,/groupPublicResearch/);
 assert.match(directory,/data-research-lens/);
 assert.match(directory,/href=\{blueDeskPublicHref\("\/blue-desk\/regime-watch\/"\+lens\.id,host\)\}/);
 assert.doesNotMatch(directory,/<details>|<summary>/);
});

test("lens detail pages use public snapshot data only and preserve countercases and tests",()=>{
 const detail=read("app/blue-desk/regime-watch/[lensId]/page.tsx");
 for(const fragment of [
  "getPublicThesisLedger(now,38)","notFound()","groupPublicResearch",
  "story.updatedAt","story.thesis","story.support","story.contradiction",
  "story.confirmation","story.invalidation","story.nextTest",
  "publicTheses===null","lens.stories.length===0","EDITORIAL_REGIME_LENSES.filter",
 ]){
  assert.ok(detail.includes(fragment),fragment);
 }
 assert.doesNotMatch(detail,/createSupabaseAdminClient|story_thesis_versions|createClient|publish|\.insert\(|\.update\(/);
});

test("lens grouping is topical association and does not mutate an existing Story",()=>{
 const sample:PublicThesis={
  id:"18c60b02-b0af-44cf-bb1f-a62723dcd1ac",slug:"oil-diesel-margins",
  title:"Diesel refining margins and crude prices",
  question:"Is tight diesel supply supporting Brent?",thesis:"Refiners may be responding differently to crude futures than to diesel product shortages.",
  support:"",contradiction:"",confirmation:"",invalidation:"",nextTest:"",
  pricedAssessment:"",updatedAt:"2026-10-27T10:00:00.000Z",status:"monitor",rank:null
 };
 const original=structuredClone(sample);
 const groups=groupPublicResearch([sample]);
 const energy=groups.find(x=>x.id==="energy");
 assert.equal(energy?.stories[0]?.id,sample.id);
 assert.deepEqual(sample,original);
 assert.equal(groups.length,9);
});

test("research lens directory card surfaces and editorial art follow all four live themes",()=>{
 const styles=read("app/blue-desk/regime-watch/regime-watch.module.css");
 const tokens=read("app/bluebelly-tokens.css");
 const preferences=read("components/blue-desk/ThemePreferences.tsx");
 for(const theme of ["yellow-black","turquoise","neon-blue","pastel-green"]){
  assert.ok(preferences.includes(theme),theme+" selectable");
  assert.ok(tokens.includes('data-bluebelly-theme="'+theme+'"')||theme==="yellow-black",theme+" token");
 }
 for(const fragment of [
  ".card{", ".card:hover,.card:focus-visible{", ".path{", ".path:hover,.path:focus-visible{",
  "background:linear-gradient(", "color-mix(in srgb,var(--bb-surface)",
  "border-color:var(--bb-accent)", "outline:2px solid var(--bb-accent)",
  ".art svg>rect{fill:var(--bb-raised)}", '.art svg>g[stroke-width="8"]{stroke:var(--bb-accent)}',
  ".content h3{", "color:var(--bb-text)", "color:var(--bb-muted)",
 ]){
  assert.ok(styles.includes(fragment),fragment);
 }
 for(const fixedColour of ["#082a42","#0a344f","#2b5e7a","#78d9ff","#8cdafa"]){
  assert.ok(!styles.includes(fixedColour),"legacy fixed-blue card value "+fixedColour);
 }
 assert.match(styles,/@media\(max-width:750px\)\{\.cards\{grid-template-columns:1fr\}/);
});
