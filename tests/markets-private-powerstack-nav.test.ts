import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";

const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const publicPage=read("app/blue-desk/markets/page.tsx");
const privatePage=read("app/power-stack/page.tsx");
const desk=read("app/my-reports/page.tsx");
const host="bluebelly-desk.vercel.app";

test("Public Markets remains open, private Power Stack is reached within My Desk",()=>{
 assert.equal(blueDeskHostAccess("/markets",host),"public");
 assert.equal(blueDeskHostAccess("/my-reports",host),"private");
 assert.equal(blueDeskHostAccess("/power-stack",host),"private");
 assert.doesNotMatch(publicPage, /<Link href="\/power-stack"|data-market-private-link|My Power Stack/);
 assert.match(desk,/href="\/my-reports\?view=portfolio"/);
 assert.match(desk,/<OwnerPortfolioHome\/>/);
 assert.match(privatePage,/createSupabaseServerClient/);
 assert.match(privatePage,/app_access_allowlist/);
 assert.match(privatePage,/legacy_source_retired === true/);
});

test("No owner-linked holdings are serialized to anonymous Markets",()=>{
 assert.doesNotMatch(publicPage,/getPowerStackResearchAssets|mergePowerStackMarketSearch|powerStack\.items/);
 assert.match(publicPage,/const observations=\[\.\.\.monitoredRows,\.\.\.breadthObservations\]/);
 const portfolio=read("components/blue-desk/OwnerPortfolioHome.tsx");
 assert.match(portfolio,/power_stack_owner_snapshots/);
 assert.match(portfolio,/snapshot\?\.legacy_source_retired===true/);
});
