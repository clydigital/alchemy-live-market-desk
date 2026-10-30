import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {getOriginalBeaPceSchedule,parseOfficialBeaPceSchedule} from "../lib/macro/official-bea-pce-schedule.ts";
import {buildOfficialMacroReleaseSeedRows} from "../lib/macro/official-actuals.ts";

const current="https://www.bea.gov/news/schedule";
const next="https://www.bea.gov/news/schedule/next-year";
const now=new Date("2026-10-30T01:00:00Z");
const doc=(year:number,rows:string[])=>"<html><body><h1>Release Schedule</h1><h2>Year "+year+
 "</h2><table>"+rows.map(x=>"<tr><td>"+x+"</td></tr>").join("")+"</table></body></html>";
test("official BEA next-year PCE schedule emits explicit 2027 reference period, no invented actual",()=>{
 const page=doc(2027,[
  "January 28 8:30 AM News Personal Income and Outlays, December 2026",
  "February 25 8:30 AM News Personal Income and Outlays, January 2027",
  "March 31 8:30 AM News Personal Income and Outlays, February 2027",
  "October 28 8:30 AM News Personal Income and Outlays, September 2027",
  "January 7 8:30 AM News U.S. International Trade, November 2026",
 ]);
 const parsed=parseOfficialBeaPceSchedule(page,next);
 assert.equal(parsed.length,4);
 assert.equal(parsed[0].date,"2027-01-28");
 assert.equal(parsed[0].referencePeriod,"December 2026");
 assert.equal(parsed[0].sourceKind,"official-live");
 assert.equal(parsed[0].actual,null);
 assert.equal(parsed[0].status,"Scheduled");
 const seeded=buildOfficialMacroReleaseSeedRows(parsed,now);
 assert.equal(seeded.length,0,"beyond the 45-day seeding horizon");
 const at=new Date("2026-12-25T00:00:00Z");
 const future=buildOfficialMacroReleaseSeedRows(parsed,at);
 assert.equal(future.length,1);
 assert.equal(future[0].release_date,"2027-01-28T13:30:00.000Z");
 assert.equal(future[0].reference_period,"December 2026");
});
test("current-year schedule matches completed October, November and December without DST mistakes",()=>{
 const page=doc(2026,[
  "October 29 8:30 AM News Personal Income and Outlays, September 2026",
  "November 25 8:30 AM News Personal Income and Outlays, October 2026",
  "December 23 8:30 AM News Personal Income and Outlays, November 2026",
 ]);
 const parsed=parseOfficialBeaPceSchedule(page,current);
 const seeded=buildOfficialMacroReleaseSeedRows(parsed,now);
 assert.equal(seeded.length,2,"Oct actual due and Nov future included; Dec outside 45 days");
 assert.equal(seeded[0].release_date,"2026-10-29T12:30:00.000Z");
 assert.equal(seeded[1].release_date,"2026-11-25T13:30:00.000Z");
});
test("unknown host, fake calendar year, invalid dates and mismatched reference months fail closed",()=>{
 assert.deepEqual(parseOfficialBeaPceSchedule(doc(2027,["February 31 8:30 AM News Personal Income and Outlays, January 2027"]),next),[]);
 assert.deepEqual(parseOfficialBeaPceSchedule(doc(2027,["January 28 8:30 AM News Personal Income and Outlays, July 2025"]),next),[]);
 assert.deepEqual(parseOfficialBeaPceSchedule(doc(2027,["January 28 8:30 AM News Personal Income and Outlays, December 2026"]),"https://fake.example/schedule"),[]);
 assert.deepEqual(parseOfficialBeaPceSchedule("Personal Income and Outlays January 2027",next),[]);
});
test("scheduled source pulls only the two original BEA URLs and cannot follow foreign redirects",async()=>{
 const calls:string[]=[];
 const source={
  [current]:doc(2026,["November 25 8:30 AM News Personal Income and Outlays, October 2026"]),
  [next]:doc(2027,["January 28 8:30 AM News Personal Income and Outlays, December 2026"]),
 };
 const result=await getOriginalBeaPceSchedule({now,fetchImpl:(async (target:RequestInfo|URL)=>{
  calls.push(String(target));
  return new Response(source[String(target) as keyof typeof source],{status:200,headers:{"content-type":"text/html"}});
 }) as typeof fetch});
 assert.deepEqual(calls,[current,next]);
 assert.equal(result.read,2);
 assert.equal(result.events.length,2);
 const collector=readFileSync(new URL("../lib/macro/official-actuals.ts",import.meta.url),"utf8");
 assert.match(collector,/getOriginalBeaPceSchedule\(\{now\}\)/);
 assert.match(collector,/seedMissingOfficialMacroReleases\(\[\.\.\.unique\.values\(\)\], now\)/);
});
