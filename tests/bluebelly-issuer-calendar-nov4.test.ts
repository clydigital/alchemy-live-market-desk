import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getIssuerEarningsSchedule,officialEarningsEvents,getForwardEarningsEvents} from "../lib/forward-earnings-sources.ts";
import {recentOriginalIssuerReleases} from "../lib/bluebelly-issuer-release-receipts.ts";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const at=new Date("2026-11-04T10:54:00Z");
test("calendar admits original issuer Nov 4–6 appointments and correct NVIDIA date",()=>{
 const rows=getIssuerEarningsSchedule(at);
 for(const ticker of ["QCOM","ARM","APP","FIG","NVO","CVS","UBER","NET","ABNB",
  "IONQ","SOUN","SMR","COP","GPN","OKLO","VST","ENB","MRNA","NVDA"]){
  const item=rows.find(r=>r.ticker===ticker);
  assert.ok(item,ticker+" absent from issuer-first calendar");
  assert.ok(item.source.startsWith("https://"),ticker);
  assert.ok(item.decisive.length>20,ticker);
 }
 const nvidia=rows.find(r=>r.ticker==="NVDA")!;
 assert.equal(nvidia.at,"2026-11-17T17:00:00-05:00");
 assert.equal(nvidia.releaseSession,"AMC");
 assert.equal(rows.some(r=>r.ticker==="DASH"),false,
  "DoorDash cancelled Nov 4 appointment must not be retained as upcoming");
 assert.equal(rows.find(r=>r.ticker==="QCOM")?.at,"2026-11-04T16:45:00-05:00");
 assert.equal(rows.find(r=>r.ticker==="NVO")?.at,"2026-11-04T07:00:00-05:00");
 assert.equal(rows.find(r=>r.ticker==="COP")?.releaseSession,"BMO");
});
test("past published originals have their source days and release gates, without fabricated analyst beats",()=>{
 const now=recentOriginalIssuerReleases(at,8);
 for(const ticker of ["DASH","SHOP","NVO"]){
  const item=now.find(r=>r.ticker===ticker);
  assert.ok(item,ticker);
  assert.ok(item.sourceUrl.startsWith("https://"));
  assert.doesNotMatch(item.confirmed,/beat consensus|missed consensus|market reacted/i);
 }
 const dash=now.find(r=>r.ticker==="DASH")!;
 assert.equal(dash.sourceDay,"2026-10-29");
 assert.match(dash.confirmed,/Moved from 4 November to 29 October/);
 assert.match(now.find(r=>r.ticker==="NVO")!.confirmed,/results have been announced/);
 const early=recentOriginalIssuerReleases(new Date("2026-11-04T06:29:00Z"),8);
 assert.equal(early.some(r=>r.ticker==="NVO"),false,"no result receipt before original release clock");
});
test("existing presenter and official source contracts remain intact; results are not inferred from the call",async()=>{
 const parsed=officialEarningsEvents(at);
 assert.ok(parsed.some(e=>e.affectedAssets.includes("ARM")&&e.verificationState==="official"));
 assert.ok(parsed.some(e=>e.affectedAssets.includes("NVDA")&&e.timePrecision==="exact"));
 const source=read("lib/forward-earnings-sources.ts");
 assert.match(source,/getDueOfficialEarningsCandidates/);
 assert.match(source,/getForwardEarningsEvents/);
 assert.doesNotMatch(source,/2026-11-18T17:00:00-05:00/);
 const page=read("app/blue-desk/calendar/page.tsx");
 const board=read("components/blue-desk/IssuerEarningsBoard.tsx");
 assert.match(page,/<IssuerEarningsBoard now=\{now\} host=\{host\}\/>/);
 assert.ok(page.indexOf("<IssuerEarningsBoard")<page.indexOf("<CatalystCalendar"),
   "new issuer reader must not be inside collapsed legacy details");
 assert.match(page,/HISTORICAL PRE-RESULTS RESEARCH/);
 assert.match(board,/RESULT PUBLISHED/);
 assert.match(board,/Call \/ webcast:/);
 assert.match(board,/data-issuer-elapsed-unverified/);
 assert.doesNotMatch(board,/process\.env|createSupabaseAdminClient|service_role|app\.notion\.com/);
 assert.equal(blueDeskHostAccess("/calendar","bluebelly-desk.vercel.app"),"public");
 assert.equal(blueDeskHostAccess("/owner/research","bluebelly-desk.vercel.app"),"private");
});
