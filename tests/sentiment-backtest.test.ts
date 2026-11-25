import test from "node:test";
import assert from "node:assert/strict";
import {backtest,type Session} from "../lib/research/sentiment-backtest.mjs";
const fixture=():Session[]=>Array.from({length:260},(_,i)=>({date:new Date(Date.UTC(2020,0,1+i)).toISOString().slice(0,10),price:i===100?90:i===101?80:i>=102?100:100,vix:i===100||i===101?35:20,oas:null}));
test("signal is at close; next session entry; fixed exit; missing credit excluded",()=>{
 const a=backtest(fixture(),{horizons:[21],maxWait:10,cost:0});
 assert.equal(a.episodes.length,1);
 const d=a.details.find(x=>x.method==="Immediate")!;
 assert.equal(d.entryDates[0].date,fixture()[101].date);assert.equal(d.end,fixture()[122].date);
 assert.equal(d.ret,25);
 assert.equal(a.result.find(x=>x.method==="Credit gate")?.n,0);
});
test("staged strategy deploys only triggered tranches; no forced fill",()=>{
 const a=backtest(fixture(),{horizons:[21],maxWait:10,cost:0});
 const d=a.details.find(x=>x.method==="Staged dip + EMA")!;
 assert.equal(d.deployed,75);assert.equal(d.entries,2);assert.equal(d.ret,6.25);
});
test("no completed outcomes for right-censored episode",()=>{
 const a=backtest(fixture().slice(0,115),{horizons:[21],maxWait:10});
 assert.equal(a.episodes.length,1);assert.equal(a.details.length,0);
 assert.equal(a.result[0].mean,null);
});
test("reject unsorted or invalid prices and use no imputed VIX crossing",()=>{
 const rows=fixture();rows[99].vix=null;
 assert.equal(backtest(rows,{horizons:[21]}).episodes.length,0);
 assert.throws(()=>backtest([...rows].reverse()));
 assert.throws(()=>backtest(rows.map((r,i)=>i===99?{...r,price:0}:r)));
});
test("cost applied to deployed capital; no trade retains zero return",()=>{
 const a=backtest(fixture(),{horizons:[21],maxWait:10,cost:.001});
 const b=a.details.find(x=>x.method==="Immediate")!;
 assert.ok(Math.abs(b.ret-24.9)<1e-9);
 const d=a.details.find(x=>x.method==="Second wave")!;
 assert.equal(d.deployed,0);assert.equal(d.ret,0);
});
