import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildScannerAssets,projectPrivateSymbols,scannerSignals,type ScanAsset} from "../lib/technical-market-scanner.ts";
import type {EmaObservation} from "../lib/bluebelly-equity-ema.ts";
test("owner membership aliases, deduplication, and archive intent do not invent a live position",()=>{
 const a=projectPrivateSymbols({holdings:[{ticker:"TENAGA",name:"Tenaga",position:{quantity:4}}],watchlist:[{ticker:"5347.KL",action:"Buy",theme:"Grid"},{ticker:"ABC",action:"Do not sell"}]},[{ticker:"5347.KL",name:"TNB"},{ticker:"TLT",name:"Bond idea"}]);
 const t=a.find(x=>x.ticker==="5347.KL")!;
 assert.deepEqual(t.memberships,["Holding","Archived watch","Saved idea"]);assert.equal(t.intent,"Buy / add");assert.equal("quantity" in t,false);
 assert.equal(a.find(x=>x.ticker==="ABC")?.intent,"Watch");
 assert.equal(a.find(x=>x.ticker==="TLT")?.intent,"Unspecified");
 const rows=buildScannerAssets([],[],a,new Date("2026-11-27T10:00:00Z"));
 assert.equal(rows.find(r=>r.ticker==="TLT")?.category,"Bond ETF");assert.ok(rows.every(r=>r.quality==="Not covered by Markets"&&r.price===null));
});
const observation={frame:"D",period:20,multiplier:1,asOf:"2026-11-25",anchorDay:"2026-11-25",warmup:"READY",ema:100,lower:98,upper:102,distancePct:1,side:"above",band:"inside",windows:{"1":{returnPct:1,approach:"up_to",emaCross:"up",upperCross:"none",lowerCross:"none",events:[{session:"2026-11-25",boundary:"ema",direction:"up"}]},"3":null,"5":null}} as EmaObservation;
const asset={ticker:"ABC",price:101,quality:"Verified sessions"} as ScanAsset;
test("signals require verified sessions and ready bands; signed boundary distance is preserved",()=>{
 const e=scannerSignals(asset,observation,"1");assert.equal(e.length,1);assert.equal(e[0].kind,"Cross");assert.equal(e[0].direction,"up");assert.ok(Math.abs(e[0].distance-1)<1e-8);
 assert.deepEqual(scannerSignals({...asset,quality:"Stale / unverified sessions"},observation,"1"),[]);
 assert.deepEqual(scannerSignals(asset,{...observation,warmup:"SHORT_WARMUP"},"1"),[]);
});
test("private scanner remains behind verified owner gate and owner ID, no private quantities sent to client",()=>{
 const page=readFileSync(new URL("../app/market-tools/page.tsx",import.meta.url),"utf8");
 assert.ok(page.indexOf("if(!access.ok)return")<page.indexOf('session.from("power_stack_owner_snapshots")'));
 assert.match(page,/\.eq\("owner_user_id",user\.id\)/);
 assert.match(page,/legacy_source_retired===true/);
 assert.match(page,/scannerView\?await getMarketMonitor/);
 assert.match(page,/\["technical-scan","EMA Scanner"\]/);
 const ui=readFileSync(new URL("../components/blue-desk/TechnicalMarketScanner.tsx",import.meta.url),"utf8");
 assert.match(ui,/My PowerStack/);assert.match(ui,/PS valuation-only/);assert.match(ui,/Archived intent/);
 assert.doesNotMatch(ui,/readTechnicalSnapshot|readFourHWatch/);
});
