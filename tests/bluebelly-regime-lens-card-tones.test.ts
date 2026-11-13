import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {lensCardSignal} from "../lib/bluebelly-regime-lens-card-signal.ts";
import type {RegimeDirectionId} from "../lib/bluebelly-regime-direction-reads.ts";
import type {RegimeMeterReading} from "../lib/bluebelly-regime-market-meter.ts";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
function proxy(id:RegimeDirectionId,direction:-1|0|1|null,state:RegimeMeterReading["state"]="observed"):RegimeMeterReading{
 const needlePeriod=id==="breadth"?"5D" as const:"1D" as const;
 return {id,label:id,scope:id,leftLabel:"Down",rightLabel:"Up",direction,needlePeriod,
  value:"1",observedAt:"2026-11-13",sourceName:"Matched data",
  sourceUrl:"https://example.org/original",state,caveat:"Proxy not fundamental",
  windows:[{label:"1D",trend:direction===null?"unknown":direction===1?"rising":direction===-1?"falling":"flat",readout:direction===null?"NOT SUPPLIED":"+1.00%"},
   {label:"3D",trend:"unknown",readout:"NOT SUPPLIED"},
   {label:"5D",trend:direction===null?"unknown":"rising",readout:direction===null?"NOT SUPPLIED":"+3.20 pp"}]
 };
}
function readout(direction:-1|0|1|null,overrides:Partial<Record<RegimeDirectionId,RegimeMeterReading>>={}){
 const rows=Object.fromEntries((["ai","fed","bonds","breadth","energy"] as const).map(id=>[id,proxy(id,direction)]));
 return {...rows,...overrides} as Record<RegimeDirectionId,RegimeMeterReading>;
}

test("each market lens tints by its own sourced proxy, with risk sign not blindly equated to rising",()=>{
 const rising=readout(1);
 for(const id of ["fed","bonds","energy"])assert.equal(lensCardSignal(id,rising).tone,"pressure",id);
 for(const id of ["ai","breadth"])assert.equal(lensCardSignal(id,rising).tone,"improving",id);
 const falling=readout(-1);
 for(const id of ["fed","bonds","energy"])assert.equal(lensCardSignal(id,falling).tone,"improving",id);
 for(const id of ["ai","breadth"])assert.equal(lensCardSignal(id,falling).tone,"pressure",id);
 assert.match(lensCardSignal("energy",falling).scope,/diesel may diverge/);
});

test("flat, missing, stale or unmeasured lens cannot acquire a bright directional colour",()=>{
 assert.equal(lensCardSignal("ai",readout(0)).tone,"mixed");
 for(const id of ["china","yen","gold","housing"]){
  const result=lensCardSignal(id,readout(1));
  assert.equal(result.tone,"unknown",id);
  assert.match(result.scope,/historical editorial is separate/);
 }
 assert.equal(lensCardSignal("fed",readout(1,{fed:proxy("fed",null)})).tone,"unknown");
 assert.equal(lensCardSignal("bonds",readout(1,{bonds:proxy("bonds",1,"unavailable")})).tone,"unknown");
 assert.equal(lensCardSignal("ai",readout(1,{ai:{...proxy("ai",1),observedAt:null}})).tone,"unknown");
 const dated=lensCardSignal("bonds",readout(1,{bonds:proxy("bonds",1,"last_reported")}));
 assert.equal(dated.dateNote,"LAST REPORTED");
 assert.equal(dated.sourceDate,"2026-11-13");
 const breadth=lensCardSignal("breadth",readout(1));
 assert.match(breadth.readout,/^5D/);
});

test("Regime grid reads semantic signals from the five existing market checks without rewriting archive opinions",()=>{
 const page=read("app/blue-desk/regime-watch/page.tsx");
 const css=read("app/blue-desk/regime-watch/regime-watch.module.css");
 assert.match(page,/lensCardSignal\(lens.id,meterReadings\)/);
 assert.match(page,/data-lens-tone=\{signal.tone\}/);
 assert.match(page,/data-lens-status=\{signal.tone\}/);
 assert.match(page,/signal.sourceDate/);
 assert.match(page,/data-legend-tone="unknown"/);
 assert.match(page,/HISTORICAL 30 OCT EDITORIAL/);
 assert.match(css,/\.card\[data-lens-tone="pressure"\]/);
 assert.match(css,/\.card\[data-lens-tone="improving"\]/);
 assert.match(css,/\.card\[data-lens-tone="mixed"\]/);
 assert.match(css,/\.card\[data-lens-tone="unknown"\]/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.doesNotMatch(page,/\.upsert\(|\.insert\(|market_regime_current/);
});
