import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessPeriod,projectPowerStackBandReviews,bandReviewLabel} from "../lib/power-stack-band-review.ts";
import type {BandCell,ScanAsset} from "../lib/technical-market-scanner.ts";
const cell=(overrides:Partial<BandCell>={}):BandCell=>({period:50,state:"Staying inside",position:"Inside",side:"Above",distance:0.5,edge:"upper",date:"2026-11-25",quality:"Verified sessions",held:false,lastExit:{direction:"up",asOf:"2026-11-20"},...overrides});
const noLevels={D:null,W:null,M:null};
test("last exit is context and not a fresh investment alert",()=>{
 const r=assessPeriod(50,{D:cell(),W:cell(),M:cell()},noLevels,null);
 assert.equal(r.state,"Monitor / retest");
 assert.equal(r.alignment,"W/M upside context");
 assert.equal(bandReviewLabel(cell()),"Inside (↑)");
});
test("opposite exit and higher frame conflict survive lower timeframe recovery",()=>{
 const r=assessPeriod(50,{D:cell({state:"Exiting ↑",position:"Above"}),W:cell({state:"Exiting ↓",position:"Below"}),M:cell()},noLevels,null);
 assert.equal(r.state,"Review downside");
 assert.match(r.alignment,/W\/M conflict/);
 assert.match(r.reason,/Opposing upside event/);
});
test("upside break against higher downside context is recovery, not reversal",()=>{
 const down=cell({lastExit:{direction:"down",asOf:"2026-11-20"}});
 const r=assessPeriod(50,{D:cell({state:"Exiting ↑",position:"Above"}),W:down,M:down},noLevels,null);
 assert.equal(r.state,"Review recovery");assert.match(r.reason,/not confirmed reversal/);
});
test("approach is not a break; 4H cannot upgrade investment priority",()=>{
 const base=assessPeriod(50,{D:cell({state:"Approaching ↑"}),W:null,M:null},noLevels,null);
 const with4H=assessPeriod(50,base.frames,noLevels,cell({state:"Exiting ↓",position:"Below",quality:"4H indicative"}));
 assert.equal(base.state,"Watch boundary");assert.equal(with4H.state,base.state);
 assert.equal(assessPeriod(50,{D:null,W:null,M:null},noLevels,with4H.execution).state,"Unassessed");
});
test("unverified and short histories cannot trigger alerts",()=>{
 assert.equal(assessPeriod(50,{D:cell({state:"Exiting ↑",quality:"Short warm-up"}),W:cell({state:"Exiting ↓",quality:"Indicative / unverified"}),M:null},noLevels,null).state,"Unassessed");
});
test("real estate is valuation-only even with technical observations",()=>{
 const a:ScanAsset={ticker:"XLRE",name:"Property",theme:"Sector",category:"ETF / proxy",region:"US",price:null,currency:"USD",asOf:null,sourceName:null,sourceUrl:null,quality:"Unavailable",observations:[],memberships:["Saved idea"],intent:"Unspecified",detail:true};
 assert.equal(projectPowerStackBandReviews([a],[])[0].state,"Valuation only");
 assert.equal(projectPowerStackBandReviews([{...a,ticker:"TLT"}],[])[0].state,"Unassessed");
});
test("PowerStack uses scanner projection and current batch without new provider fanout",()=>{
 const page=readFileSync(new URL("../app/power-stack/page.tsx",import.meta.url),"utf8");
 assert.match(page,/buildScannerAssets\(bbCoverage.rows,publicTape\?\.rows/);
 assert.match(page,/fourHReads=\{fourHWatch\?\?\[\]\}/);
 const ui=readFileSync(new URL("../components/blue-desk/PowerStackBandReview.tsx",import.meta.url),"utf8");
 assert.match(ui,/projectPowerStackBandReviews\(assets,reads\)/);
 assert.doesNotMatch(ui,/readFourHWatch|fetch\(/);
});
