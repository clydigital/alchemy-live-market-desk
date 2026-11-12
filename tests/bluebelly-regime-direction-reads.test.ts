import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getRegimeDirectionPacket,getRegimeDirectionPackets,REGIME_DIRECTION_IDS} from "../lib/bluebelly-regime-direction-reads.ts";
import {buildDirectionQuickRead,type DirectionEvidence} from "../lib/bluebelly-direction-quick-read.ts";
const now=new Date("2026-11-12T06:00:00Z");
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("five Regime topics use independent dated evidence and distinct questions",()=>{
 const packets=getRegimeDirectionPackets(now);
 assert.deepEqual(packets.map(x=>x.id),["energy","fed","bonds","ai","breadth"]);
 assert.equal(packets.length,REGIME_DIRECTION_IDS.length);
 assert.equal(new Set(packets.map(x=>x.question)).size,5);
 for(const packet of packets){
  assert.ok(packet.read.evidence.length>=2,packet.id);
  assert.ok(packet.read.evidence.every(x=>x.sourceUrl.startsWith("https://")),packet.id);
  assert.ok(packet.read.evidence.every(x=>x.date<="2026-11-12"),packet.id);
  assert.ok(packet.meaning.length>45,packet.id);
  assert.equal(packet.followUpHref,"#signals",packet.id);
  assert.deepEqual(packet.read.windows.map(x=>x.label),["1D","3D","5D"]);
 }
 assert.equal(getRegimeDirectionPacket("housing",now),null);
 assert.equal(getRegimeDirectionPacket("hormuz",now),null);
});
test("evidence windows describe distinct topic-specific changes, not hardcoded bull calls",()=>{
 const expected={
  energy:["worse","mixed","mixed"],
  fed:["worse","worse","worse"],
  bonds:["unknown","unknown","unknown"],
  ai:["mixed","mixed","mixed"],
  breadth:["worse","mixed","mixed"]
 } as const;
 for(const id of REGIME_DIRECTION_IDS){
  const packet=getRegimeDirectionPacket(id,now)!;
  assert.deepEqual(packet.read.windows.map(x=>x.trend),expected[id],id);
 }
 const breadth=getRegimeDirectionPacket("breadth",now)!;
 assert.equal(breadth.read.windows[0].better,0);
 assert.equal(breadth.read.windows[0].worse,1);
 assert.equal(breadth.read.windows[2].better,1);
 assert.equal(breadth.read.evidence.filter(e=>!!e.comparisonSourceUrl).length,2);
});
test("closed Treasury market cannot become an invented live 11 Nov yield direction",()=>{
 const bonds=getRegimeDirectionPacket("bonds",now)!;
 assert.equal(bonds.read.sourceDay,"2026-11-10");
 assert.equal(bonds.read.stale,true);
 assert.ok(bonds.read.windows.every(x=>x.trend==="unknown"));
 const fresh=getRegimeDirectionPacket("bonds",new Date("2026-11-11T04:00:00Z"))!;
 assert.equal(fresh.read.stale,false);
 assert.ok(fresh.read.windows.every(x=>x.trend==="worse"));
});
test("a fresh future-looking alert never carries forward as permanent directional certainty",()=>{
 for(const id of REGIME_DIRECTION_IDS){
  const p=getRegimeDirectionPacket(id,new Date("2026-11-16T05:00:00Z"))!;
  assert.equal(p.read.stale,true,id);
  assert.ok(p.read.windows.every(x=>x.trend==="unknown"),id);
 }
 const sample:DirectionEvidence={
  id:"test",date:"2026-11-11",direction:"better",title:"Valid signal",sourceName:"Named source",
  sourceUrl:"https://example.org/source",comparisonSourceUrl:"javascript:alert(1)",limitation:"Source validation"
 };
 assert.equal(buildDirectionQuickRead([sample],now).evidence.length,0);
});
test("public Regime hub and lens pages share a single accessible read without publishing private feeds",()=>{
 const hub=read("app/blue-desk/regime-watch/page.tsx");
 const lens=read("app/blue-desk/regime-watch/[lensId]/page.tsx");
 const ui=read("components/blue-desk/DirectionQuickRead.tsx");
 const css=read("app/blue-desk/regime-watch/regime-watch.module.css");
 const store=read("lib/bluebelly-regime-direction-reads.ts");
 assert.match(hub,/data-regime-direction-overview="five-evidence-vetted-lenses"/);
 assert.match(hub,/data-direction-overview-card/);
 assert.match(lens,/getRegimeDirectionPacket\(lens.id,now\)/);
 assert.match(lens,/RegimeManualChallenge lens=\{lens.id\}/);
 assert.match(lens,/RegimeOutlookMeter/);
 assert.match(ui,/comparisonSourceUrl/);
 assert.match(ui,/not the probability of peace/);
 assert.match(ui,/data-direction-window/);
 assert.match(css,/scroll-snap-type:x mandatory/);
 assert.doesNotMatch(store+hub+lens,/\.insert\(|\.upsert\(|supabase\.rpc\(/);
});
