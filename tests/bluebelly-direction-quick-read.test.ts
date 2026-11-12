import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildDirectionQuickRead,type DirectionEvidence} from "../lib/bluebelly-direction-quick-read.ts";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const input=JSON.parse(read("data/bluebelly-hormuz-peace-signals.json")) as {version:number;signals:DirectionEvidence[]};
test("1D/3D/5D peace directions are dated, sourced and explicitly non-probabilistic",()=>{
 assert.equal(input.version,1);
 assert.equal(input.signals.length,5);
 const result=buildDirectionQuickRead(input.signals,new Date("2026-11-12T06:00:00Z"));
 assert.equal(result.sourceDay,"2026-11-12");
 assert.deepEqual(result.windows.map(w=>[w.label,w.trend,w.count]),[
  ["1D","worse",2],["3D","mixed",5],["5D","mixed",5]
 ]);
 assert.ok(result.evidence.every(s=>s.sourceUrl.startsWith("https://")));
});
test("stale or unavailable source packets yield unknown rather than falsely improving",()=>{
 const stale=buildDirectionQuickRead(input.signals,new Date("2026-11-14T06:00:00Z"));
 assert.equal(stale.stale,true);
 assert.ok(stale.windows.every(w=>w.trend==="unknown"));
 const empty=buildDirectionQuickRead([],new Date("2026-11-12T06:00:00Z"));
 assert.ok(empty.windows.every(w=>w.trend==="unknown"&&w.count===0));
});
test("future dated and spoofed sources cannot influence the direction",()=>{
 const bad:DirectionEvidence[]=[
  {...input.signals[0],id:"bad-url",sourceUrl:"javascript:alert(1)"},
  {...input.signals[1],id:"bad-future",date:"2026-11-30"},
  {...input.signals[1],id:"bad-credentials",sourceUrl:"https://user:pwd@example.com"},
  {...input.signals[1],id:"bad-date",date:"2026-02-30"},
 ];
 const out=buildDirectionQuickRead([...bad,...input.signals],new Date("2026-11-12T06:00:00Z"));
 assert.equal(out.evidence.length,5);
 assert.equal(out.windows[0].trend,"worse");
});
test("public Hormuz UI exposes three readable windows and source detail without a new writer",()=>{
 const component=read("components/blue-desk/DirectionQuickRead.tsx");
 const host=read("components/blue-desk/HormuzSituationBrief.tsx");
 const css=read("components/blue-desk/DirectionQuickRead.module.css");
 assert.match(component,/data-direction-window/);
 assert.match(component,/data-direction-trend/);
 assert.match(component,/INSUFFICIENT \/ STALE/);
 assert.match(component,/sourceUrl/);
 assert.match(component,/probability of peace/);
 assert.match(host,/Are we getting closer to peace\?/);
 assert.match(host,/buildDirectionQuickRead/);
 for(const word of ["better","mixed","worse"])assert.match(css,new RegExp('data-direction-trend="'+word+'"'));
 assert.doesNotMatch(component+host,/\.insert\(|\.update\(|\.upsert\(/);
});
