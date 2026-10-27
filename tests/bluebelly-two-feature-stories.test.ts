import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {featureStories,getFeatureStory} from "../lib/blue-desk-feature-stories.ts";
import {blueDeskHostAccess,blueDeskPresentationTarget,BLUEBELLY_PRESENTATION_HOST} from "../lib/blue-desk-host.ts";

const source=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("Asia equities and global bonds are distinct dated editorial stories",()=>{
 assert.deepEqual(Object.keys(featureStories).sort(),["asia-equities","global-bonds"]);
 assert.notEqual(featureStories["asia-equities"].title,featureStories["global-bonds"].title);
 assert.match(featureStories["asia-equities"].thesis,/China/);
 assert.match(featureStories["global-bonds"].thesis,/France/);
 for(const story of Object.values(featureStories)){
  assert.match(story.asOf,/2026/);
  assert.ok(story.scenes.length>=4,"should preserve chronology and nuance");
  assert.ok(story.manual.length>=3,"each story needs a manual investigation section");
  assert.ok(story.sources.some(s=>s.kind==="primary"),"original institutional source");
  for(const fact of story.facts)for(const i of fact.sourceIds)assert.ok(story.sources[i]?.url.startsWith("https://"),"fact provenance");
  for(const scene of story.scenes)for(const i of scene.sourceIds)assert.ok(story.sources[i]?.url.startsWith("https://"),"scene provenance");
 }
 assert.equal(getFeatureStory("unknown"),undefined);
});

test("Greece historical facts are not misrepresented as France's current situation",()=>{
 const bond=featureStories["global-bonds"];
 const story=bond.scenes.map(s=>s.paragraphs.join(" ")).join("\n");
 assert.match(story,/2012 restructuring/);
 assert.match(story,/53\.5%/);
 assert.match(story,/2027 budget/);
 assert.match(story,/excessive-deficit/);
 assert.match(story,/does not mean it is replaying 2010 Greece/);
 assert.match(bond.facts.find(x=>x.detail.includes("22 Oct"))?.value||"",/178/);
 assert.match(bond.facts.find(x=>x.detail.includes("27 Oct"))?.value||"",/153/);
});
test("Feature routes are specifically public without widening owner or API access",()=>{
 for(const slug of ["asia-equities","global-bonds"]){
  const clean="/features/"+slug,internal="/blue-desk/features/"+slug;
  assert.equal(blueDeskPresentationTarget(clean,BLUEBELLY_PRESENTATION_HOST),internal);
  assert.equal(blueDeskHostAccess(clean,BLUEBELLY_PRESENTATION_HOST),"public");
  assert.equal(blueDeskHostAccess(internal,BLUEBELLY_PRESENTATION_HOST),"public");
 }
 assert.equal(blueDeskPresentationTarget("/features/private-notes",BLUEBELLY_PRESENTATION_HOST),null);
 assert.equal(blueDeskHostAccess("/features/private-notes",BLUEBELLY_PRESENTATION_HOST),"blocked");
 assert.equal(blueDeskHostAccess("/api/owner/daily-research",BLUEBELLY_PRESENTATION_HOST),"private");
 assert.equal(blueDeskHostAccess("/owner/research",BLUEBELLY_PRESENTATION_HOST),"private");
});
test("Research is discoverable on both home and Key Stories and separate from canonical Story projections",()=>{
 const home=source("app/blue-desk/page.tsx");
 const keys=source("app/blue-desk/key-stories/page.tsx");
 const feature=source("app/blue-desk/features/[slug]/page.tsx");
 const owner=source("app/my-reports/page.tsx");
 for(const slug of ["asia-equities","global-bonds"]){
  assert.match(home,new RegExp("/blue-desk/features/"+slug));
  assert.match(keys,new RegExp("/blue-desk/features/"+slug));
  assert.match(owner,new RegExp("/features/"+slug));
 }
 assert.match(feature,/data-evidence-status="independent-editorial-not-canonical"/);
 assert.match(feature,/data-manual-research=/);
 assert.match(feature,/feature\.sources\.map/);
 assert.match(feature,/feature\.scenes\.map/);
 assert.doesNotMatch(feature,/service_role|supabaseAdmin|writeStoryThesisVersion/);
});
