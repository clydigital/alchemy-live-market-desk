import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import test from "node:test";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const host="bluebelly-desk.vercel.app";
test("Power Stack has no Bluebelly route, private view or public navigation",()=>{
 assert.equal(blueDeskHostAccess("/markets",host),"public");
 assert.equal(blueDeskHostAccess("/power-stack",host),"blocked");
 assert.equal(existsSync(new URL("../app/power-stack/page.tsx",import.meta.url)),false);
 assert.equal(existsSync(new URL("../app/api/power-stack-context/route.ts",import.meta.url)),false);
 assert.doesNotMatch(read("components/blue-desk/BlueDeskHeader.tsx"),/Power Stack/);
 assert.doesNotMatch(read("app/blue-desk/markets/page.tsx"),/power.?stack|portfolio/i);
});
test("Canonical Bluebelly intake and daily brief do not import Power Stack research",()=>{
 assert.doesNotMatch(read("lib/scheduled-research-input.ts"),/powerStack|PowerStack|power-stack/i);
 assert.doesNotMatch(read("lib/intelligence/supabase.ts"),/powerStack|PowerStack|power-stack/i);
 assert.equal(existsSync(new URL("../lib/power-stack-ratings.ts",import.meta.url)),false);
 assert.equal(existsSync(new URL("../lib/power-stack-themes.ts",import.meta.url)),false);
});
