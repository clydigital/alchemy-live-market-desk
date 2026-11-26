import test from "node:test";
import assert from "node:assert/strict";
import {classifyXFlash,xWireSourcePolicy,xWireNearDuplicate} from "../lib/x-wire-source-policy.ts";
import {rankXWireMarketCandidates} from "../lib/x-wire-market-candidates.ts";
import {xWireSourceMaterial} from "../lib/x-wire-source-material.ts";
const now=new Date("2026-11-19T21:52:37Z");
const post=(handle:string,id:number,text:string,age=8,images:string[]=[])=>({handle,id:String(BigInt("2123400000000000000")+BigInt(id)),url:`https://x.com/${handle}/status/${BigInt("2123400000000000000")+BigInt(id)}`,text,publishedAt:new Date(now.getTime()-age*3600000).toISOString(),intakeStatus:"discovery",images,quoteUrl:null,attribution:"THIRD_PARTY_ONLY" as const});
test("squawk gate retains actual surprises, rejects repetitive commentary",()=>{
 assert.equal(classifyXFlash("US INITIAL JOBLESS CLAIMS: 203K (EST 198K)"),"macro_data");
 assert.equal(classifyXFlash("ECB RAISES INTEREST RATES 25 BPS"),"policy_decision");
 assert.equal(classifyXFlash("IRAN'S IRGC SAYS 2 TANKERS HIT MINE IN EASTERN HORMUZ"),"conflict_shock");
 assert.ok(classifyXFlash("TSMC, SAMSUNG SUSPEND SOME SHIPMENTS TO CHINESE CUSTOMERS"));
 assert.equal(classifyXFlash("PUTIN SAYS HE WANTS BETTER US-RUSSIA TIES"),null);
 assert.equal(classifyXFlash("FED OFFICIAL EXPECTS RATES MAY STAY HIGH"),null);
 assert.equal(xWireSourcePolicy("FirstSquawk").recoveryHours,24);
 assert.equal(xWireSourcePolicy("DrJStrategy").recoveryHours,72);
});
test("noisy alert cannot dominate and older squawks are not backlog candidates",()=>{
 const p=[...Array.from({length:40},(_,i)=>post("FirstSquawk",i,"US CPI ACTUAL 2.5% EST 2.4%",1)),post("FirstSquawk",99,"FED RAISES RATES 25 BPS",30),post("DrJStrategy",100,"SPY 200 DMA historical signal in 16 prior cases",22,["https://pbs.twimg.com/media/example.jpg"]),post("OddStats",101,"QQQ prior 5 trading days after a 4% decline",18),post("HFI_Research",102,"Natural gas positioning and crude oil fundamentals",16),post("macropaperr",103,"Fed inflation and Treasury yields after the release",12)];
 const selected=rankXWireMarketCandidates(p as never,now,9);assert.ok(selected.some(x=>x.post.handle==="DrJStrategy"));assert.ok(selected.some(x=>x.post.handle==="OddStats"));assert.equal(selected.filter(x=>x.post.handle==="FirstSquawk").length,1);assert.ok(!selected.some(x=>x.post.id===p[40].id));
 assert.equal(xWireNearDuplicate("US CPI ACTUAL 2.5% EST 2.4%","US CPI ACTUAL 2.6% EST 2.4%"),false);
});
test("only vetted public material locators, never interpretation or unknown hosts",()=>{
 const got=xWireSourceMaterial({text:"https://bluekurtic.com/model/ https://internal.invalid/private https://bluekurtic.com/?token=secret",images:["https://pbs.twimg.com/media/example.jpg?name=orig","https://untrusted.invalid/chart.png"],quoteUrl:"https://x.com/OddStats/status/2123400000000000000"});
 assert.deepEqual(got.articleUrls,["https://bluekurtic.com/model/"]);assert.equal(got.imageUrls.length,1);assert.equal(got.interpretation,"NOT_REVIEWED");assert.ok(got.quoteUrl);
});
