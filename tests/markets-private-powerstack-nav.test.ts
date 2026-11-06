import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import test from "node:test";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const host="bluebelly-desk.vercel.app";
test("Power Stack is a single owner-only route; anonymous Markets remains separate",()=>{
 assert.equal(blueDeskHostAccess("/markets",host),"public");
 assert.equal(blueDeskHostAccess("/power-stack",host),"private");
 for(const path of ["/power-stack/","/power-stack/data","/api/power-stack-context",
   "/data/holdings-fundamentals.json","/data/watchlist.json"]){
  assert.equal(blueDeskHostAccess(path,host),"blocked",path);
 }
 assert.equal(existsSync(new URL("../app/power-stack/page.tsx",import.meta.url)),true);
 assert.equal(existsSync(new URL("../app/api/power-stack-context/route.ts",import.meta.url)),false);
 const header=read("components/blue-desk/BlueDeskHeader.tsx");
 const nav=header.split("const PUBLIC_NAV = [")[1]?.split("] as const;")[0]||"";
 assert.doesNotMatch(nav,/Power Stack/);
 const more=header.split("const PUBLIC_MORE = [")[1]?.split("] as const;")[0]||"";
 assert.doesNotMatch(more,/Power Stack/);
 assert.ok(read("app/my-reports/page.tsx").includes('href="/power-stack"'));
 assert.doesNotMatch(read("app/blue-desk/markets/page.tsx"),/power.?stack|OwnerPortfolio|data-market-private-link/i);
});
test("Canonical Bluebelly intake and daily brief do not import Power Stack research",()=>{
 assert.doesNotMatch(read("lib/scheduled-research-input.ts"),/powerStack|PowerStack|power-stack/i);
 assert.doesNotMatch(read("lib/intelligence/supabase.ts"),/powerStack|PowerStack|power-stack/i);
 assert.equal(existsSync(new URL("../lib/power-stack-ratings.ts",import.meta.url)),false);
 assert.equal(existsSync(new URL("../lib/power-stack-themes.ts",import.meta.url)),false);
});
