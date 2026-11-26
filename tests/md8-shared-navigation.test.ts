import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {blueDeskPublicHref,blueDeskHostAccess} from "../lib/blue-desk-host.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const header=read("components/blue-desk/BlueDeskHeader.tsx"),desk=read("app/my-reports/page.tsx");
test("desktop sidebar and mobile drawer share command groups",()=>{
 assert.match(header,/sectionGroups\.map\(group=>.*group\.links\.map\(commandLink\)/);
 assert.match(header,/aria-label="Bluebelly mobile"[^\n]*sectionGroups\.map\(group=>.*group\.links\.map/);
 assert.match(header,/label:"MARKET VIEWS",links:marketViews/);
 for(const mode of ["assets","compare","watch","risk"]){
  const path="/blue-desk/markets?mode="+mode;
  assert.ok(header.includes('"'+path+'"'));
  assert.equal(blueDeskPublicHref(path,"bluebelly-desk.vercel.app"),"/markets?mode="+mode);
  assert.equal(blueDeskHostAccess("/markets","bluebelly-desk.vercel.app"),"public");
 }
});
test("private deep links stay in My Desk and existing routes remain protected",()=>{
 for(const view of ["technical","relationships","intake","diagnostics"]){
  assert.ok(desk.includes('href="/market-tools?view='+view));
  assert.ok(!header.includes('"/market-tools?view='+view));
 }
 assert.equal(blueDeskHostAccess("/market-tools","bluebelly-desk.vercel.app"),"private");
 assert.equal(blueDeskHostAccess("/owner/research","bluebelly-desk.vercel.app"),"private");
 assert.doesNotMatch(header,/\["Research Archive",/);
});
