import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

import {blueDeskHostAccess,blueDeskPresentationTarget} from "../lib/blue-desk-host.ts";
import {safeOwnerReturnPath} from "../lib/supabase/owner-return-path.ts";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const host="bluebelly-desk.vercel.app";

test("Markets stays public but the Power Stack subroute requires Google-owner auth",()=>{
 for(const path of ["/markets","/blue-desk/markets"]){
  assert.equal(blueDeskHostAccess(path,host),"public");
  assert.equal(blueDeskPresentationTarget(path,host),"/blue-desk/markets");
 }
 assert.equal(blueDeskHostAccess("/markets/powerstack",host),"private");
 assert.equal(blueDeskPresentationTarget("/markets/powerstack",host),null);
 for(const path of ["/markets/powerstack/","/markets/powerstack.json","/markets/powerstack/api"]){
  assert.equal(blueDeskHostAccess(path,host),"blocked");
 }
 assert.equal(safeOwnerReturnPath("/markets/powerstack"),"/markets/powerstack");
 assert.equal(safeOwnerReturnPath("//evil.example/markets/powerstack"),"/my-reports");
});

test("Anonymous public Markets does not fetch, merge or serialize Power Stack research",()=>{
 const page=read("app/blue-desk/markets/page.tsx");
 assert.doesNotMatch(page,/getPowerStackResearchAssets|mergePowerStackMarketSearch|powerStack\.items/);
 assert.match(page,/if \(group === "powerstack"\) redirect\("\/markets\/powerstack"\)/);
 assert.match(page,/item\.id === "powerstack" \? "\/markets\/powerstack"/);
 assert.match(page,/const observations=\[\.\.\.sourceObservations,\.\.\.breadthObservations\]/);
});

test("Private view independently checks Google identity and active allowlist before loading research",()=>{
 const page=read("app/markets/powerstack/page.tsx");
 for(const marker of [
  "createSupabaseServerClient","supabase.auth.getUser()",
  'user.app_metadata?.provider !== "google"',"app_access_allowlist",
  '.eq("active",true)',"getPowerStackResearchAssets()",
  "mergePowerStackMarketSearch", 'robots: { index: false, follow: false }',
 ]) assert.ok(page.includes(marker),marker);
 assert.ok(page.indexOf('getPowerStackResearchAssets()') >
  page.indexOf('.eq("active",true)'));
 assert.match(page,/data-powerstack-auth-boundary="google-allowlisted"/);
 const middleware=read("middleware.ts");
 assert.ok(middleware.indexOf('if (accessScope === "public")') <
  middleware.indexOf("getClaims()"));
 assert.ok(middleware.includes('app_access_allowlist'));
});

test("Anonymous screener can no longer discover holdings through search",()=>{
 const page=read("app/blue-desk/markets/page.tsx");
 assert.doesNotMatch(page,/<PublicMarketScreener[^>]+observations=\{merged\}/);
 assert.match(page,/<PublicMarketScreener key=\{group\} observations=\{observations\}/);
});
