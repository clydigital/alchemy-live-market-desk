import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { bluebellyOwnerPresenterHref } from "../lib/bluebelly-owner-presenter-links.ts";
import { blueDeskHostAccess, blueDeskPresentationTarget } from "../lib/blue-desk-host.ts";

const blue="bluebelly-desk.vercel.app";
const live="alchemy-live-market-desk.vercel.app";
const preview="alchemy-live-market-desk-q7jxltce0-rogue-magazine.vercel.app";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("Presenter history links select clean path only on exact Bluebelly hostname",()=>{
  for(const host of [blue," BLUEBELLY-DESK.VERCEL.APP:443 "]){
    assert.equal(bluebellyOwnerPresenterHref("current",host),"/presenter");
    assert.equal(bluebellyOwnerPresenterHref("history",host),"/presenter/full-prep");
    assert.equal(blueDeskHostAccess("/presenter/full-prep",host),"private");
    assert.equal(blueDeskPresentationTarget("/presenter/full-prep",host),"/blue-desk/presenter/full-prep");
  }
  for(const host of [live,preview,"preview.example.invalid",null,""]){
    assert.equal(bluebellyOwnerPresenterHref("current",host),"/blue-desk/presenter");
    assert.equal(bluebellyOwnerPresenterHref("history",host),"/blue-desk/presenter/full-prep");
    assert.equal(blueDeskPresentationTarget("/presenter/full-prep",host),null);
    assert.equal(blueDeskHostAccess("/blue-desk/presenter/full-prep",host),"private");
  }
});

test("Presenter current-to-history links and redirect use same-host private destination",()=>{
  const current=read("app/blue-desk/presenter/page.tsx");
  assert.match(current,/const host = \(await headers\(\)\)\.get\("host"\)/);
  assert.match(current,/redirect\(bluebellyOwnerPresenterHref\("history",host\) \+ "\?" \+ params\.toString\(\)\)/);
  assert.match(current,/href=\{bluebellyOwnerPresenterHref\("history",host\)\}/);
  assert.doesNotMatch(current,/href="\/presenter\/full-prep"/);
  assert.doesNotMatch(current,/redirect\("\/presenter\/full-prep/);
});

test("Archive picker, current-Prep return and unavailable fallback all preserve host",()=>{
  const history=read("app/blue-desk/presenter/full-prep/page.tsx");
  assert.match(history,/const host = \(await headers\(\)\)\.get\("host"\)/);
  assert.match(history,/href=\{bluebellyOwnerPresenterHref\("history",host\) \+ "\?edition=" \+ encodeURIComponent\(row\.snapshotId\)\}/);
  const matches=history.match(/href=\{bluebellyOwnerPresenterHref\("current",host\)\}/g)||[];
  assert.equal(matches.length,3,"picker, normal view and failure return must use correct link");
  assert.doesNotMatch(history,/href="\/presenter"/);
  assert.doesNotMatch(history,/href=\{"\/presenter\/full-prep/);
  assert.match(history,/getHybridDirectDailyBriefSuperseders\(requested\)/);
  assert.match(history,/getDossierV2PresentationSelectionById\(frozen\.dossierId\)/);
});

test("fix does not change public route authority, API privileges or preview policies",()=>{
  for(const host of [blue,live]){
    for(const path of ["/","/key-stories","/rates","/what-changed","/calendar","/markets"]){
      assert.equal(blueDeskHostAccess(path,host),"public");
    }
  }
  for(const path of ["/api/cron/research/morning","/hybrid-output/prepare",
    "/api/owner/bluebelly/v1/overview","/blue-desk/presenter/full-prep"]){
    assert.equal(blueDeskHostAccess(path,blue),"blocked");
  }
  const middleware=read("middleware.ts");
  assert.match(middleware,/supabase\.auth\.getClaims\(\)/);
  assert.match(middleware,/app_access_allowlist/);
  assert.match(middleware,/bluebellyOwnerApi/);
  const json=JSON.parse(read("vercel.json"));
  assert.deepEqual(json.git.deploymentEnabled,{"*":false,main:true});
});
