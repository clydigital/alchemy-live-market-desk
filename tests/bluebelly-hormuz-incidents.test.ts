import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {decodeHormuzIncidents} from "../lib/bluebelly-hormuz-incidents-core.ts";
const now=new Date("2026-10-29T12:00:00.000Z");
const built=Math.floor(+now/1000)-7200;
const COLS=["id","type","lat","lon","ts","vessel_type","place","fire","sunk","abandoned","casualty","time_late","text"];
const STR=["UKMTO-183","Suspicious Activity","Tanker","Northern Arabian Gulf",
 "A tanker was reportedly on fire. Crew status and damage are under investigation.",
 "UKMTO-182","Attack","Strait of Hormuz",
 "A tanker reportedly was hit by a projectile while transiting outbound.",
 "UKMTO-184","Advisory","Gulf of Aden",
 "Security advisory near the Gulf of Aden."];
const stamp=Math.floor(Date.parse("2026-10-26T14:00:00Z")/1000);
const raw={v:1,built,attribution:"UKMTO (ukmto.org), Crown copyright, Open Government Licence v3.0",
 t:{c:COLS,k:[0,1,5,6,12],r:[
  [0,1,29.2,49.2,stamp,2,3,1,0,0,0,0,4],
  [5,6,26.28,56.55,stamp-3600,2,7,0,0,0,0,1,8],
  [9,10,12.7,47.5,stamp-7200,2,11,0,0,0,0,0,12],
  [0,1,29.2,49.2,stamp,2,3,1,0,0,0,0,4],
 ]},s:STR};
test("bounded source-attributed incidents are relevant Gulf events only",()=>{
 const d=decodeHormuzIncidents(raw,now);
 assert.equal(d.freshness,"recent");
 assert.equal(d.reports.length,2);
 assert.equal(d.totalWindow,2);
 assert.deepEqual(d.reports.map(x=>x.id),["UKMTO-183","UKMTO-182"]);
 assert.equal(d.reports[1].timeLate,true);
 assert.equal(d.reports[0].sourceUrl,"https://www.ukmto.org/recent-incidents");
 assert.equal(d.reports[0].casualtyReported,false);
});
test("no qualified source is not a zero-incident declaration",()=>{
 for(const altered of [
  null,{}, {...raw,v:2},{...raw,attribution:"rumour"},
  {...raw,t:{...raw.t,c:["id","type"]}},
  {...raw,built:Math.floor(+now/1000)+3600}
 ]){
  const d=decodeHormuzIncidents(altered,now);
  assert.equal(d.freshness,"unavailable");
  assert.equal(d.totalWindow,0);
  assert.match(d.reason||"",/unavailable|invalid/i);
 }
 const d=decodeHormuzIncidents({...raw,built:built-48*3600},now);
 assert.equal(d.freshness,"stale");
 assert.equal(d.totalWindow,2);
});
test("bad geo, future event time and malformed binary evidence never appear",()=>{
 const mutated={...raw,t:{...raw.t,r:[
  [0,1,42.1,30.1,stamp,2,3,0,0,0,0,0,4],
  [5,6,26.28,56.55,Math.floor(+now/1000)+600,2,7,0,0,0,0,0,8],
  [0,1,29,49,stamp,2,3,2,0,0,0,0,4],
 ]}};
 const d=decodeHormuzIncidents(mutated,now);
 assert.equal(d.reports.length,0);
});
test("public tracker reads existing incident endpoint only through server-side caching",()=>{
 const server=readFileSync(new URL("../lib/bluebelly-hormuz-incidents.ts",import.meta.url),"utf8");
 const page=readFileSync(new URL("../app/blue-desk/hormuz/page.tsx",import.meta.url),"utf8");
 assert.match(server,/import "server-only"/);
 assert.match(server,/unstable_cache/);
 assert.match(server,/revalidate:1800/);
 assert.match(server,/redirect:"error"/);
 assert.match(server,/HORMUZ_INCIDENTS_SOURCE/);
 assert.match(page,/getHormuzIncidents\(now\)/);
 assert.match(page,/data-incident-status=\{incidents\.freshness\}/);
 assert.match(page,/UKMTO/);
 assert.doesNotMatch(page,/createSupabaseAdminClient|\\.rpc\(|CRON_SECRET/);
});
