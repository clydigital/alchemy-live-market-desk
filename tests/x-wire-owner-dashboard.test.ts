import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseXWireOwnerFilters,xWireOwnerHref,X_WIRE_PAGE_SIZE} from "../lib/x-wire-owner-query.ts";

test("X Wire filters bound page, date, search and controlled topics",()=>{
 const f=parseXWireOwnerFilters({page:"99999",q:"oil,(%;)_".repeat(30),theme:"energy_shipping",
   status:"deferred",period:"all",handle:"@HormuzReport"});
 assert.equal(f.page,1);assert.ok(f.q.length<=100);assert.ok(!/[(),%_]/.test(f.q));
 assert.equal(f.handle,"HormuzReport");assert.equal(f.theme,"energy_shipping");
 assert.equal(f.status,"deferred");assert.equal(f.period,"all");assert.equal(X_WIRE_PAGE_SIZE,25);
 const bad=parseXWireOwnerFilters({page:"-100",theme:"unknown",status:"approved",period:"yesterday",handle:"../admin"});
 assert.equal(bad.page,1);assert.equal(bad.theme,"");assert.equal(bad.status,"");assert.equal(bad.period,"7d");assert.equal(bad.handle,"");
});
test("owner navigation retains filters across server-side pages",()=>{
 const f=parseXWireOwnerFilters({page:"3",handle:"OddStats",theme:"macro_rates_fx",period:"30d",q:"Treasury"});
 const href=xWireOwnerHref(f,{page:4});
 assert.ok(href.startsWith("/owner/x-wire?"));
 const url=new URL(href,"https://bluebelly-desk.vercel.app");
 assert.equal(url.searchParams.get("page"),"4");
 assert.equal(url.searchParams.get("handle"),"OddStats");
 assert.equal(url.searchParams.get("theme"),"macro_rates_fx");
 assert.equal(url.searchParams.get("period"),"30d");
 assert.equal(url.searchParams.get("q"),"Treasury");
});
test("owner pagination has read-only server-backed selection; homepage only receives aggregates",()=>{
 const owner=readFileSync(new URL("../lib/x-wire-owner-view.ts",import.meta.url),"utf8");
 const page=readFileSync(new URL("../app/owner/x-wire/page.tsx",import.meta.url),"utf8");
 const home=readFileSync(new URL("../app/blue-desk/page.tsx",import.meta.url),"utf8");
 const aggregate=readFileSync(new URL("../lib/bluebelly-absorption-health.ts",import.meta.url),"utf8");
 assert.match(owner,/\.range\(\(filters.page-1\)\*X_WIRE_PAGE_SIZE/);
 assert.match(owner,/count:"exact"/);assert.doesNotMatch(owner,/\.rpc\(|\.upsert\(|\.insert\(|\.update\(/);
 assert.match(page,/form method="get"/);assert.match(page,/xWireOwnerHref\(f,\{page:f.page\+1\}\)/);
 assert.match(home,/AbsorptionHealth health=\{absorptionHealth\}/);
 assert.match(aggregate,/head:true,count:"exact"/);
 assert.doesNotMatch(aggregate,/\.select\("body|\.select\("original_url|\.update\(|\.rpc\(/);
});
