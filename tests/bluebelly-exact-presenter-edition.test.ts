import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseBluebellyExactPresenterQuery } from "../lib/bluebelly-exact-presenter-query.ts";
import { blueDeskHostAccess, blueDeskPresentationTarget } from "../lib/blue-desk-host.ts";

const edition="fcea17ef-f575-4283-a363-7d5fa9c918c7";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("P1b starts in a picker only when no exact pinned identity is supplied",()=>{
  assert.deepEqual(parseBluebellyExactPresenterQuery({}),{state:"picker",editionId:null,focus:{}});
  assert.equal(parseBluebellyExactPresenterQuery({story:"ai"}).state,"invalid");
  assert.equal(parseBluebellyExactPresenterQuery({edition:""}).state,"invalid");
  assert.equal(parseBluebellyExactPresenterQuery({edition:["x",edition]}).state,"invalid");
  assert.equal(parseBluebellyExactPresenterQuery({edition:"today"}).state,"invalid");
  assert.equal(parseBluebellyExactPresenterQuery({edition,unknown:"x"}).state,"invalid");
  assert.equal(parseBluebellyExactPresenterQuery({edition,story:["first","second"]}).state,"invalid");
  assert.equal(parseBluebellyExactPresenterQuery({edition,story:"\ncontrol"}).state,"invalid");
  assert.equal(parseBluebellyExactPresenterQuery({edition,motion:" ".repeat(5)}).state,"invalid");
  assert.equal(parseBluebellyExactPresenterQuery({edition,regime:"x".repeat(181)}).state,"invalid");
});

test("P1b parses exactly one immutable edition and bounded focus, without changing identity",()=>{
  assert.deepEqual(parseBluebellyExactPresenterQuery({
    edition,story:"ai-power-story",motion:"item-1",regime:"us-rate-regime",event:"cpi",
  }),{
    state:"exact",editionId:edition,
    focus:{story:"ai-power-story",motion:"item-1",regime:"us-rate-regime",event:"cpi"},
  });
  assert.equal(parseBluebellyExactPresenterQuery({edition:edition.toUpperCase()}).editionId,edition);
});

test("P1b native owner route has same identity gate as P1a, no open APIs",()=>{
  for (const host of ["bluebelly-desk.vercel.app","alchemy-live-market-desk.vercel.app"]){
    assert.equal(blueDeskHostAccess("/presenter/full-prep",host),"private");
    assert.equal(blueDeskPresentationTarget("/presenter/full-prep",host),"/blue-desk/presenter/full-prep");
    assert.equal(blueDeskHostAccess("/presenter",host),"private");
  }
  assert.equal(blueDeskHostAccess("/blue-desk/presenter/full-prep","bluebelly-desk.vercel.app"),"blocked");
  for(const path of ["/api/dossier-v2","/api/owner/bluebelly/v1/overview",
    "/api/owner/bluebelly/v1/story-version","/hybrid-output/prepare","/api/research-update"]){
    assert.equal(blueDeskHostAccess(path,"bluebelly-desk.vercel.app"),"blocked",path);
  }
  const middleware=read("middleware.ts");
  assert.match(middleware,/supabase\.auth\.getClaims\(\)/);
  assert.match(middleware,/app_access_allowlist/);
  assert.match(middleware,/accessScope === "blocked"/);
  assert.match(middleware,/accessScope === "public"/);
  assert.doesNotMatch(middleware,/if \(!dashboardAuthRequired\(\)\) return presentationResponse\(request\)/);
});

test("P1b archive lookup has exact ID and independent Dossier vintage checks",()=>{
  const page=read("app/blue-desk/presenter/full-prep/page.tsx");
  assert.match(page,/getHybridExactDailyBriefEdition\(requestedId\)/);
  assert.match(page,/getHybridPresenterEditionCandidates\(\{fresh:true\}\)/);
  assert.match(page,/buildPresenterPrepEditionIndex\(recent,deskData\?\.researchRuns\|\|\[\]\)/);
  assert.match(page,/presenterDossierEditionContextFromPayload\(selected\?\.payload\)/);
  assert.match(page,/getDossierV2PresentationSelectionById\(frozen\.dossierId\)/);
  assert.match(page,/dossierSelection\?\.selectedDossierId===frozen\?\.dossierId/);
  assert.match(page,/dossierSelection\?\.selectedAsOf===frozen\?\.dossierAsOf/);
  assert.match(page,/buildPresenterPrepSourceProjection\(\{/);
  assert.match(page,/buildPresenterPrepEditorialReadiness\(\{/);
  assert.match(page,/requestedEditionId:requestedId/);
  assert.match(page,/selectedEditionId:selected\?\.id\?\?null/);
  assert.match(page,/currentEditionId,/);
  assert.match(page,/input\.state==="invalid"\)notFound\(\)/);
  assert.match(page,/projection\.status!=="READY"\|\|!projection\.pinned/);
  assert.doesNotMatch(page,/getLiveDeskHomepageDailyBrief|getCurrentMarketMotion|getMarketMonitor|getLatestEditorialSlate|getCurrentVerifiedMarketMotion|\.upsert\(|\.insert\(|\.update\(/);
});

test("P1b running order is only local to the pinned edition and cannot prime current writer",()=>{
  const page=read("app/blue-desk/presenter/full-prep/page.tsx");
  const current=read("app/blue-desk/presenter/page.tsx");
  const session=read("components/live-desk/PresenterPrepSession.tsx");
  assert.match(current,/href="\/presenter\/full-prep"/);
  assert.match(page,/<PresenterPrepSession editionId=\{projection\.pinned\.editionId\}/);
  assert.match(page,/dossierId=\{projection\.pinned\.dossierId\}/);
  assert.match(page,/href="\/presenter"/);
  assert.doesNotMatch(page,/<EditorialWorkbench|\/api\/owner\/editorial-generate|\/hybrid-output\/prepare/);
  assert.match(session,/localStorage\.setItem/);
  assert.match(session,/editionId,/);
  assert.match(session,/dossierId,/);
});
