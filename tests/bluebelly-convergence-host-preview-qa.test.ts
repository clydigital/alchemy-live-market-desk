import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  blueDeskHostAccess,
  blueDeskPresentationTarget,
  blueDeskPublicHref,
  publicLiveLegacyTabDestination,
} from "../lib/blue-desk-host.ts";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const BLUE="bluebelly-desk.vercel.app";
const LIVE="alchemy-live-market-desk.vercel.app";
const PREVIEW="alchemy-live-market-desk-q7jxltce0-rogue-magazine.vercel.app";

const routes=[
  ["/","/blue-desk"],
  ["/markets","/blue-desk/markets"],
  ["/calendar","/blue-desk/calendar"],
  ["/key-stories","/blue-desk/key-stories"],
  ["/rates","/blue-desk/rates"],
  ["/what-changed","/blue-desk/what-changed"],
] as const;

test("integrated clean public navigation is only valid on the two exact approved reader hosts",()=>{
  for(const [path,internal] of routes){
    for(const host of [BLUE,LIVE]){
      assert.equal(blueDeskHostAccess(path,host),"public",host+path);
      assert.equal(blueDeskPresentationTarget(path,host),internal,host+path);
    }
    assert.equal(blueDeskHostAccess(path,PREVIEW),"private",path);
    assert.equal(blueDeskPresentationTarget(path,PREVIEW),null,path);
    const file="app"+internal+"/page.tsx";
    assert.ok(read(file).length>200,file+" must exist");
  }
  assert.equal(blueDeskHostAccess("/blue-desk/key-stories",PREVIEW),"private");
  assert.equal(blueDeskHostAccess("/blue-desk/rates",PREVIEW),"private");
  assert.equal(blueDeskHostAccess("/blue-desk/what-changed",PREVIEW),"private");
  assert.equal(blueDeskPublicHref("/blue-desk",PREVIEW),"/blue-desk");
  assert.equal(blueDeskPublicHref("/blue-desk",BLUE),"/");
});

test("canonical public links are not equivalent to protected preview visual acceptance",()=>{
  const header=read("components/blue-desk/BlueDeskHeader.tsx");
  assert.match(header,/isBlueDeskPublicReaderHost\(host\)/);
  assert.match(header,/publicHost && !ownerWorkspace \? PUBLIC_NAV : PRIVATE_NAV/);
  for(const path of ["/key-stories","/rates","/what-changed","/calendar","/markets"]){
    assert.ok(header.includes('"'+path+'"'),path+" missing from nav");
  }
  for(const fragment of ['"/#stories-title"','"/#rates-title"','"/#motion-title"']){
    assert.equal(header.includes(fragment),false,"Primary navigation must not loop to home "+fragment);
  }
  for(const [tab,destination] of [
    ["stories","/key-stories"],["rates","/rates"],["motion","/what-changed"],
    ["calendar","/calendar"],
  ]){
    assert.equal(publicLiveLegacyTabDestination(tab),destination);
  }
});

test("private Presenter and Writer remain separately protected on the exact Bluebelly host",()=>{
  for(const route of ["/presenter","/presenter/full-prep",
    "/api/presenter/technical-checks","/api/owner/editorial-generate"]){
    assert.equal(blueDeskHostAccess(route,BLUE),"private",route);
  }
  assert.equal(blueDeskPresentationTarget("/presenter",BLUE),"/blue-desk/presenter");
  assert.equal(blueDeskPresentationTarget("/presenter/full-prep",BLUE),"/blue-desk/presenter/full-prep");
  assert.equal(blueDeskPresentationTarget("/presenter/full-prep",PREVIEW),null);
  for(const blocked of ["/api/owner/bluebelly/v1/overview","/api/research-update",
    "/api/cron/research/morning","/hybrid-output/prepare",
    "/blue-desk/presenter","/blue-desk/presenter/full-prep",
    "/presenter/full-prep/raw","/owner/editorial"]){
    assert.equal(blueDeskHostAccess(blocked,BLUE),"blocked",blocked);
  }
  const middleware=read("middleware.ts");
  const publicGate=middleware.indexOf('if (accessScope === "public") return presentationResponse(request)');
  const login=middleware.indexOf("supabase.auth.getClaims()");
  assert.ok(publicGate>=0&&login>publicGate);
  assert.match(middleware,/supabase\.auth\.getClaims\(\)/);
  assert.match(middleware,/app_access_allowlist/);
  assert.match(middleware,/bluebellyOwnerApi/);
  assert.match(middleware,/\["\/api\/owner\/editorial-generate", "\/api\/presenter\/technical-checks"\]\.includes\(pathname\)/);
});

test("main-based integration never permits unprotected branch previews or adds schedules",()=>{
  const deploy=JSON.parse(read("vercel.json")) as {
    git:{deploymentEnabled:Record<string,boolean>};
    ignoreCommand:string;
    crons:Array<{path:string;schedule:string}>;
  };
  assert.deepEqual(deploy.git.deploymentEnabled,{"*":false,main:true});
  assert.match(deploy.ignoreCommand,/VERCEL_GIT_COMMIT_REF/);
  assert.match(deploy.ignoreCommand,/main/);
  assert.equal(deploy.crons.length>0,true);
  assert.equal(deploy.crons.some(x=>x.path==="/api/owner/editorial-generate"),false);
  assert.equal(deploy.crons.some(x=>x.path==="/presenter/full-prep"),false);
});
