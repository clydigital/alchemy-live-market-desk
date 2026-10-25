import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";

const header=readFileSync(new URL("../components/blue-desk/BlueDeskHeader.tsx",import.meta.url),"utf8");
const homepage=readFileSync(new URL("../app/blue-desk/page.tsx",import.meta.url),"utf8");
function links(group:string){
 const match=header.match(new RegExp("const "+group+" = \\[([\\s\\S]*?)\\] as const;"));
 assert.ok(match,"expected "+group+" list");
 return [...match[1].matchAll(/\["[^"]+",\s*"([^"]+)"\]/g)].map(m=>m[1]);
}
test("anonymous Bluebelly navigation advertises only existing public routes",()=>{
 const paths=links("PUBLIC_NAV");
 assert.deepEqual(paths,["/","/markets","/key-stories","/rates","/what-changed","/calendar"]);
 for(const route of paths){
  assert.equal(blueDeskHostAccess(route,"bluebelly-desk.vercel.app"),"public",route);
 }
 assert.equal(blueDeskHostAccess("/presenter","bluebelly-desk.vercel.app"),"private");
 assert.equal(blueDeskHostAccess("/owner/editorial","bluebelly-desk.vercel.app"),"blocked");
 for(const route of ["/key-stories","/rates","/what-changed"]){
  const page=new URL("../app/blue-desk"+route+"/page.tsx",import.meta.url);
  assert.ok(readFileSync(page,"utf8").includes("data-bluebelly-expanded"),route);
 }
});
test("private native Bluebelly navigation contains no legacy Live Desk exit",()=>{
 const privatePaths=links("PRIVATE_NAV");
 assert.deepEqual(privatePaths,[
  "/blue-desk","/blue-desk/markets","/blue-desk/key-stories",
  "/blue-desk/rates","/blue-desk/what-changed",
  "/blue-desk/calendar","/blue-desk/presenter",
 ]);
 const legacyPaths=links("LEGACY_OWNER_NAV");
 for(const old of ["/owner/editorial","/owner/presenter","/articles",
   "/hybrid-output/prepare","/data/macro","/concepts"]){
  assert.ok(legacyPaths.includes(old),old+" remains available to legacy owners");
  assert.ok(!privatePaths.includes(old),old+" must not appear inside Bluebelly");
  assert.equal(blueDeskHostAccess(old,"bluebelly-desk.vercel.app"),"blocked",old);
 }
 assert.match(header,/ownerWorkspace \? LEGACY_OWNER_NAV : publicHost \? PUBLIC_NAV : PRIVATE_NAV/);
 assert.match(header,/activePath === "\/owner\/editorial"/);
 assert.match(header,/activePath === "\/owner\/presenter"/);
});
test("home actions open native Bluebelly pages without sending readers back into Live Desk",()=>{
 assert.match(homepage,/Continue in Bluebelly/);
 assert.match(homepage,/blueDeskPublicHref\("\/blue-desk\/key-stories",host\)/);
 assert.match(homepage,/blueDeskPublicHref\("\/blue-desk\/markets", host\)/);
 assert.match(homepage,/blueDeskPublicHref\("\/blue-desk\/calendar",host\)/);
 assert.match(homepage,/sourceFact\.sourceUrl/);
 for(const path of ["/dossier","/regimes","/hybrid-output/prepare","/whats-new","/articles"]){
  assert.ok(!homepage.includes('href="'+path+'"'),path);
 }
});
