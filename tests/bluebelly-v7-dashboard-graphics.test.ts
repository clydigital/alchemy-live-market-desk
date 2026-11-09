import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {projectWindowChangeLanes} from "../lib/bluebelly-market-bar-visuals.ts";

const source=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

test("relative 1D/3D/5D bars preserve sign and actual units without synthesising price paths",()=>{
  const x=projectWindowChangeLanes({change:0.31,change3d:-2.53,change5d:-2.70},"%");
  assert.deepEqual(x.map(row=>row.name),["1D","3D","5D"]);
  assert.deepEqual(x.map(row=>row.direction),["up","down","down"]);
  assert.deepEqual(x.map(row=>row.display),["+0.31%","-2.53%","-2.70%"]);
  assert.equal(x[0].leftPercent,50);
  assert.ok(x[1].leftPercent<50);
  assert.equal(x[2].widthPercent,49.5);
  assert.ok(x.every(row=>row.widthPercent>=0&&row.widthPercent<=49.5));
});
test("window bars do not invent missing data or encode flat change as growth",()=>{
  const m=projectWindowChangeLanes({change:null,change3d:Number.NaN,change5d:0},"bp");
  assert.deepEqual(m.map(x=>x.direction),["unknown","unknown","flat"]);
  assert.deepEqual(m.map(x=>x.display),["—","—","0.0bp"]);
  assert.ok(m.every(x=>x.widthPercent===0));
  const basis=projectWindowChangeLanes({change:5,change3d:-10,change5d:null},"bp");
  assert.deepEqual(basis.map(x=>x.display),["+5.0bp","-10.0bp","—"]);
  assert.equal(basis[1].leftPercent,.5);
  assert.equal(projectWindowChangeLanes({change:0.5,change3d:-0.3,change5d:0},"pp")[0].display,"+0.50pp");
});
test("market-first graphical composition retains source dates, private boundary, and true fallbacks",()=>{
  const page=source("app/blue-desk/page.tsx");
  const styles=source("app/blue-desk/market-first-home.module.css");
  const bars=source("components/blue-desk/MarketWindowBars.tsx");
  assert.match(page,/data-home-market-first="source-dated-terminal"/);
  assert.match(page,/data-v7-market-tiles="source-dated"/);
  assert.match(page,/<MarketWindowBars change=\{row\.change\} change3d=\{row\.change3d\}/);
  assert.match(page,/change5d=\{row\.change5d\} unit=\{row\.changeUnit\}/);
  assert.match(page,/<DualTimestamp value=\{row\.asOf\} sourceDate=\{row\.asOf\}/);
  assert.match(page,/getMarketMonitor\(\)/);
  assert.match(page,/Source-dated market quotes are unavailable or stale/);
  assert.match(page,/data-home-editorial-reader="legacy-on-demand"/);
  assert.match(page,/<AbsorptionHealth health=\{absorptionHealth\}/);
  assert.match(page,/!publicHost\?<AbsorptionHealth/);
  assert.match(styles,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(styles,/@media\(max-width:1350px\)/);
  assert.match(styles,/@media\(max-width:760px\)/);
  assert.match(styles,/prefers-reduced-motion/);
  assert.match(bars,/source-dated-relative-bars/);
  assert.doesNotMatch(bars,/Math\.random|Math\.sin|localStorage|fetch\(/);
  assert.doesNotMatch(page,/const ASSETS\s*=/);
});
