import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {NVIDIA_EARNINGS_WATCH,nvidiaEventState} from "../lib/bluebelly-nvidia-earnings-watch.ts";
import {powerStackResearchTopics,projectPowerStackResearch,type PowerStackTracked} from "../lib/power-stack-research-links.ts";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("NVIDIA case retains original-source evidence, not generated EPS, forecasts or a made-up price call",()=>{
 const watch=NVIDIA_EARNINGS_WATCH;
 assert.equal(watch.ticker,"NVDA");
 assert.equal(watch.companyQ3Guidance.revenueBn,108);
 assert.equal(watch.companyQ3Guidance.revenueLowBn,105.84);
 assert.equal(watch.companyQ3Guidance.revenueHighBn,110.16);
 assert.equal(watch.companyQ3Guidance.grossMarginPct,74);
 assert.equal(watch.previousQuarter.revenueBn,96.221);
 assert.equal(watch.previousQuarter.dataCenterRevenueBn,89);
 assert.match(watch.transition.summary,/Colette Kress/);
 assert.match(watch.transition.originalUrl,/nvidianews\.nvidia\.com/);
 assert.match(watch.companyQ3Guidance.originalUrl,/investor\.nvidia\.com/);
 assert.ok(watch.scenarios.length===3);
 assert.ok(watch.nextChecks.some(x=>x.includes("CFO commentary")));
 assert.match(watch.signal.market,/two-sided turnover/);
 assert.match(watch.signal.uncertainty,/MIXED/);
 assert.match(watch.signal.demand,/demand for NVDA shares/);
 assert.doesNotMatch(JSON.stringify(watch),/guaranteed 50%|sure buy|institutional buying confirmed/i);
});

test("Q3 timing never becomes published earnings simply because calendar time passes",()=>{
 assert.equal(nvidiaEventState(new Date("2026-11-13T01:00:00Z")),"UPCOMING");
 assert.equal(nvidiaEventState(new Date("2026-11-17T21:21:00Z")),"RESULTS_DUE_CHECK_ISSUER");
 assert.equal(nvidiaEventState(new Date("2026-11-18T10:00:00Z")),"RESULTS_DUE_CHECK_ISSUER");
 assert.equal(nvidiaEventState(new Date("2026-11-18T10:00:00Z"),true),"OFFICIAL_RESULTS_CONFIRMED");
});

test("Bluebelly AI Regime and owner-only Power Stack share a single dated decision framework",()=>{
 const regime=read("app/blue-desk/regime-watch/[lensId]/page.tsx");
 const ps=read("app/power-stack/page.tsx");
 const component=read("components/blue-desk/NvidiaEarningsDecisionWatch.tsx");
 assert.match(regime,/lens\.id==="ai"\?<NvidiaEarningsDecisionWatch mode="regime"/);
 assert.match(ps,/<NvidiaEarningsDecisionWatch mode="power-stack"/);
 assert.ok(ps.indexOf("legacy_source_retired === true")<ps.indexOf("<NvidiaEarningsDecisionWatch"));
 assert.ok(ps.indexOf("app_access_allowlist")<ps.indexOf("<NvidiaEarningsDecisionWatch"));
 assert.match(ps,/recordedScope:holdings\.some\(h=>h\.ticker==="NVDA"\)/);
 assert.match(component,/data-nvda-earnings-state=\{state\}/);
 assert.match(component,/data-power-stack-nvda-entries="conditional-not-orders"/);
 assert.match(component,/No live price inferred/);
 assert.match(component,/not an official close or evidence of net institutional buying/);
 assert.match(component,/Source-checked historical facts \+ conditional analysis/);
 assert.doesNotMatch(regime,/getPowerStackResearchAssets|power_stack_owner_snapshots|power_stack_quote_observations|data-ps-nvidia-scope/);
});

test("Power Stack preserves multiple dated manual findings and maps newest data-centre risk names by symbol only",()=>{
 const assets:PowerStackTracked[]=[
  {ticker:"NVDA",name:"NVIDIA",scope:"archived_watchlist"},
  {ticker:"NBIS",name:"Nebius",scope:"archived_watchlist"},
  {ticker:"TLT",name:"TLT",scope:"bond_watch"},
 ];
 const now=new Date("2026-11-13T01:00:00Z");
 const groups=projectPowerStackResearch(assets,[],now);
 const ai=groups.find(x=>x.topic==="ai");
 assert.ok(ai);
 assert.ok(ai!.assets.some(x=>x.ticker==="NVDA"));
 assert.ok(ai!.assets.some(x=>x.ticker==="NBIS"));
 assert.ok(ai!.manuals.length>=2);
 assert.ok(ai!.manuals.some(x=>x.id.includes("nebius")));
 assert.ok(ai!.manuals.some(x=>x.id.includes("coreweave")));
 assert.equal(ai!.manual?.id,ai!.manuals[0].id);
 const ui=read("components/blue-desk/PowerStackResearchImpact.tsx");
 assert.match(ui,/group\.manuals\.map\(sweep=>/);
 assert.match(ui,/data-power-stack-manual-source=\{sweep\.id\}/);
 assert.match(ui,/MANUAL SWEEP FINDINGS/);
 assert.ok(powerStackResearchTopics(assets).includes("bonds"));
});

test("Newsroom Jensen source remains original company event and links to the earnings decision",()=>{
 const watch=read("lib/bluebelly-jensen-governance-watch.ts");
 const component=read("components/blue-desk/JensenGovernanceWatch.tsx");
 assert.match(watch,/CEO TRANSITION CONFIRMED/);
 assert.match(component,/#nvidia-earnings-decision/);
});
