import test from "node:test";
import assert from "node:assert/strict";
import {searchPublicAssetCatalogue,PUBLIC_CATALOGUE_REFERENCE_COUNT} from "../lib/bluebelly-public-asset-catalogue.ts";
import type {PublicMarketObservation} from "../lib/blue-desk-public-markets.ts";
import {readFileSync} from "node:fs";
function obs(symbol:string,last:number|null,asOf:string|null="2026-11-06"):PublicMarketObservation{
 return {id:"m-"+symbol,symbol,label:symbol+" monitored",type:"Sector",last,
   change:null,change3d:null,change5d:null,changeUnit:"%",frequency:"daily",
   asOf,sourceName:"Source",sourceUrl:null};
}
test("catalogue extends monitored identities without implying live reference quotes",()=>{
 const catalogue=searchPublicAssetCatalogue([obs("SPY",583),obs("XLK",null)],{scope:"all",query:"SPY"});
 assert.equal(catalogue.filteredCount,1);
 assert.equal(catalogue.items[0].status,"SOURCE_DATED");
 assert.equal(catalogue.items[0].last,583);
 const added=searchPublicAssetCatalogue([obs("SPY",583)],{scope:"additional",query:"USDMYR"});
 assert.equal(added.filteredCount,1);
 assert.equal(added.items[0].status,"CATALOGUE_ONLY");
 assert.equal(added.items[0].last,null);
 assert.equal(added.items[0].asOf,null);
 assert.ok(PUBLIC_CATALOGUE_REFERENCE_COUNT>=60);
});
test("missing or stale provider observations never become priced",()=>{
 const catalog=searchPublicAssetCatalogue([obs("XLK",null),{...obs("XLF",100),dataStatus:"UNAVAILABLE_OR_STALE"}],{scope:"monitored"});
 assert.equal(catalog.monitoredCount,2);
 assert.equal(catalog.pricedCount,0);
 assert.ok(catalog.items.every(row=>row.status==="MONITORED_UNAVAILABLE"&&row.last===null));
});
test("pagination and text/coverage filters are deterministic and bounded",()=>{
 const rows=[obs("XLK",100),obs("XLF",99)];
 const first=searchPublicAssetCatalogue(rows,{scope:"all",page:"1"});
 const second=searchPublicAssetCatalogue(rows,{scope:"all",page:"2"});
 assert.equal(first.items.length,15);
 assert.equal(second.items.length,15);
 assert.notEqual(first.items[0].symbol,second.items[0].symbol);
 const last=searchPublicAssetCatalogue(rows,{scope:"all",page:"99999"});
 assert.equal(last.page,last.pages);
 assert.ok(last.items.length>0&&last.items.length<=15);
 const missing=searchPublicAssetCatalogue(rows,{scope:"all",query:"NO-SUCH-INSTRUMENT"});
 assert.equal(missing.filteredCount,0);
 assert.deepEqual(missing.items,[]);
 assert.equal(missing.page,1);
});
test("public page exposes reference discovery separately from the monitored screener",()=>{
 const page=readFileSync(new URL("../app/blue-desk/markets/page.tsx",import.meta.url),"utf8");
 const component=readFileSync(new URL("../components/blue-desk/PublicAssetCatalogue.tsx",import.meta.url),"utf8");
 assert.match(page,/searchPublicAssetCatalogue/);
 assert.match(page,/<PublicAssetCatalogue /);
 assert.match(component,/CATALOGUE_ONLY/);
 assert.match(component,/data-public-asset-catalogue="identity-only"/);
 assert.doesNotMatch(component,/owner\/|private_|power.stack|Math\.random/);
});
