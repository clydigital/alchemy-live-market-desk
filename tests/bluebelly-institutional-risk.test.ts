import test from "node:test";
import assert from "node:assert/strict";
import {buildInstitutionalRisk, impliedVar, interpretInstitutionalRisk, reconcileRiskWithEquityTape} from "../lib/bluebelly-institutional-risk.ts";
import {scheduledUsEquityCloseHourET} from "../lib/bluebelly-us-equity-trading-calendar.ts";
import type {MarketCompassSummary} from "../lib/bluebelly-market-compass.ts";
import {readFileSync} from "node:fs";

const NOW = new Date("2026-11-19T10:00:00Z");
function series(id: string, values: number[], end = "2026-11-18") {
  const days: string[] = [];
  for (let t = Date.parse(end); days.length < values.length; t -= 86400000) {
    const d = new Date(t).toISOString().slice(0,10);
    if (scheduledUsEquityCloseHourET(d) !== null) days.unshift(d);
  }
  return {id, points: days.map((d,i)=>({time:Date.parse(d)/1000,close:values[i]})),
    frequency:"daily" as const,sourceName:"Test daily history",sourceUrl:"https://example.org"};
}
test("known VIX and VXN closes produce the stated daily VaR estimates",()=>{
  const [sp, nq] = buildInstitutionalRisk([series("vix",[17.49,18.7,19.3,22.91,25.46,24.56]),series("vxn",[26.74,28.55,29.38,32.9,34.44,33.12])],[],NOW);
  assert.equal(sp.state,"current");
  assert.equal(sp.var95?.toFixed(2),"2.54");
  assert.equal(nq.var95?.toFixed(2),"3.43");
  assert.equal(sp.var99?.toFixed(2),"3.60");
  assert.equal(sp.change5d?.toFixed(1),"40.4");
  assert.equal(sp.capacity5d?.toFixed(1),"-28.8");
  assert.equal(sp.change1d?.toFixed(1),"-3.5");
  assert.equal(sp.volatility,24.56);
  assert.equal(sp.volatilityChange1d?.toFixed(2),"-0.90");
  assert.equal(sp.percentile,null);
});
test("historical risk percentile uses 252 completed observations; realised risk uses matched 20-return history",()=>{
  const [sp] = buildInstitutionalRisk([series("vix",[...Array(251).fill(20),24.56])],[series("spx",Array.from({length:21},(_,i)=>100+i+(i%2)))],NOW);
  assert.equal(sp.percentile,100);
  assert.ok(sp.realised && sp.realised.var95>0);
  assert.equal(sp.realised?.day,sp.asOf);
});
test("percentile ranks available source observations without requiring unverified older holiday schedules",()=>{
  const vix=series("vix",[...Array(252).fill(20),24.56]);
  vix.points.splice(5,1); // holiday beyond the verified calendar, or missing older observation
  assert.equal(buildInstitutionalRisk([vix],[],NOW)[0].percentile,100);
});
test("behind and stale histories are explicit; unavailable cannot become zero or current signal",()=>{
  const [behind,missing] = buildInstitutionalRisk([series("vix",[20,24],"2026-11-17")],[],NOW);
  assert.equal(behind.state,"behind");assert.equal(behind.asOf,"2026-11-17");assert.equal(behind.expected,"2026-11-18");
  assert.equal(missing.state,"unavailable");assert.equal(missing.var95,null);
  const [old] = buildInstitutionalRisk([series("vix",[20,25],"2026-11-06")],[],NOW);
  assert.equal(old.state,"unavailable");assert.equal(old.var95,null);
});
test("rejects conflicting dates, gaps and unfinished observations",()=>{
  const vix=series("vix",[20,21,22,23,24,25]);
  vix.points.splice(3,1);
  const [gap] = buildInstitutionalRisk([vix],[series("spx",Array(21).fill(100),"2026-11-17")],NOW);
  assert.equal(gap.change5d,null);assert.equal(gap.realised,null);
  const [future] = buildInstitutionalRisk([series("vix",[20,21,22],"2026-11-19")],[],NOW);
  assert.equal(future.asOf,"2026-11-18");assert.equal(future.var95,impliedVar(21));
  vix.points.push({...vix.points.at(-1)!,close:50});
  assert.equal(buildInstitutionalRisk([vix],[],NOW)[0].state,"unavailable");
});

test("interpretation separates absolute historical risk from direction and suppresses stale signals",()=>{
  const base = {state:"current" as const, percentile:90, change1d:-3, change5d:10, capacity5d:-9.09};
  const rising = interpretInstitutionalRisk(base);
  assert.equal(rising.level,"extreme");assert.equal(rising.direction,"pressure");assert.ok(rising.divergence);
  const easing = interpretInstitutionalRisk({...base,change5d:-10,capacity5d:11.11});
  assert.equal(easing.action,"Cautious re-risking possible");assert.equal(easing.level,"extreme");
  assert.equal(interpretInstitutionalRisk({...base,percentile:75}).level,"high");
  assert.equal(interpretInstitutionalRisk({...base,percentile:25}).level,"normal");
  assert.equal(interpretInstitutionalRisk({...base,percentile:24.9,change5d:-10}).action,"Room to rebuild exposure");
  assert.equal(interpretInstitutionalRisk({...base,change5d:0.8}).direction,"flat");
  assert.equal(interpretInstitutionalRisk({...base,state:"behind"}).direction,"unknown");
  assert.equal(interpretInstitutionalRisk({...base,percentile:null,change5d:null}).direction,"unknown");
});


const SESSION_NOW=new Date("2026-11-24T04:00:00Z");
const riskOnTape:MarketCompassSummary={
 state:"RISK_ON",title:"Risk appetite improving",explanation:"Four-ETF positive session",
 contradiction:"Some relative gaps",nextTest:"Check credit",sourceSession:"2026-11-23",
 evidenceCount:4,note:"Observed completed-session ETFs only",
};
test("Friday VIX cannot disprove a later Monday risk-on tape",()=>{
 const rows=buildInstitutionalRisk([
  series("vix",[25,35.89],"2026-11-20"),
  series("vxn",[36,45.25],"2026-11-20"),
 ],[],SESSION_NOW);
 const read=reconcileRiskWithEquityTape(rows,riskOnTape);
 assert.equal(read.state,"VOLATILITY_DATA_PENDING");
 assert.equal(read.equitySession,"2026-11-23");
 assert.equal(read.volatilitySession,"2026-11-20");
 assert.match(read.explanation,/not a contradiction/);
 assert.equal(rows[0].state,"behind");
});

test("matching Monday equity/volatility relief can coexist with high absolute VaR",()=>{
 const rows=buildInstitutionalRisk([
  series("vix",[...Array(250).fill(18),35.89,27.5],"2026-11-23"),
  series("vxn",[...Array(250).fill(25),45.25,34],"2026-11-23"),
 ],[],SESSION_NOW);
 assert.ok(rows[0].var95!>2);
 assert.equal(rows[0].state,"current");
 assert.equal(reconcileRiskWithEquityTape(rows,riskOnTape).state,"RELIEF_ALIGNED");
 const opposite=buildInstitutionalRisk([
  series("vix",[...Array(250).fill(18),25,31],"2026-11-23"),
  series("vxn",[...Array(250).fill(25),33,39],"2026-11-23"),
 ],[],SESSION_NOW);
 assert.equal(reconcileRiskWithEquityTape(opposite,riskOnTape).state,"EQUITY_VIX_CONTRADICTION");
});

test("missing VXN or unverified stock session cannot manufacture matched confirmation",()=>{
 const partial=buildInstitutionalRisk([series("vix",[30,24],"2026-11-23")],[],SESSION_NOW);
 assert.equal(reconcileRiskWithEquityTape(partial,riskOnTape).state,"UNMEASURED");
 assert.equal(reconcileRiskWithEquityTape(partial,{...riskOnTape,state:"UNMEASURED",sourceSession:null}).state,"UNMEASURED");
});

test("volatility fallback refreshes faster than general FRED price histories without bypassing source dates",()=>{
 const source=readFileSync("lib/market-monitor.ts","utf8");
 assert.match(source,/revalidate: volSeries \? 30 \* 60 : 60 \* 60 \* 6/);
 assert.match(source,/bluebelly_volatility_source_unavailable/);
 const home=readFileSync("app/blue-desk/page.tsx","utf8");
 const markets=readFileSync("app/blue-desk/markets/page.tsx","utf8");
 assert.doesNotMatch(home,/<InstitutionalRiskMonitor|loadVolatilityAnchors/);
 assert.match(home,/markets\?mode=risk#institutional-risk-heading/);
 assert.match(markets,/mode==="risk"\?loadVolatilityAnchors/);
 assert.match(markets,/<InstitutionalRiskMonitor/);
 assert.match(markets,/equityTape=\{buildMarketCompassSummary\(/);
 assert.match(markets,/Risk &amp; Positioning/);
});
