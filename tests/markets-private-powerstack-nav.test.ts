import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";

const page=readFileSync(new URL("../app/blue-desk/markets/page.tsx",import.meta.url),"utf8");
const privatePage=readFileSync(new URL("../app/power-stack/page.tsx",import.meta.url),"utf8");
const host="bluebelly-desk.vercel.app";

test("Public Markets links to Google-protected Power Stack without gating the whole market page",()=>{
 assert.equal(blueDeskHostAccess("/markets",host),"public");
 assert.equal(blueDeskHostAccess("/power-stack",host),"private");
 assert.match(page,/<Link href="\/power-stack"/);
 assert.match(page,/data-market-private-link="google-required"/);
 assert.match(page,/My Power Stack/);
 assert.match(privatePage,/createSupabaseServerClient/);
 assert.match(privatePage,/app_access_allowlist/);
 assert.match(privatePage,/legacy_source_retired === true/);
});

test("Public ETF radar is neutral; no owner-linked holdings are serialized to public Markets",()=>{
 const helper=readFileSync(new URL("../lib/bluebelly-power-stack-public.ts",import.meta.url),"utf8");
 assert.match(helper,/Neutral, immutable public symbol catalogue/);
 assert.doesNotMatch(helper,/WATCH_TAPE_URL|HOLD_TAPE_URL|holdings-fundamentals\.json/);
 assert.match(page,/Public instrument search is independent of private Power Stack holdings/);
});
