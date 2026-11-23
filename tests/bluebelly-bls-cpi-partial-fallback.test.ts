import test from "node:test";
import assert from "node:assert/strict";
import {parseBlsMonthlyOnlyCpiOriginal,isSameOriginalBlsArchive} from "../lib/macro/bls-cpi-monthly-only.ts";
import {parseOfficialCpiMetricRows} from "../lib/macro/official-cpi-metrics.ts";
import {resolveOfficialActual} from "../lib/macro/official-actuals.ts";
import {projectUsEconStatWatch} from "../lib/bluebelly-us-econ-stat-watch.ts";

const releaseDate="2026-11-10T13:30:00Z";
const sourceUrl="https://www.bls.gov/news.release/archives/cpi_11102026.htm";
const body=[
 "<html><h1>CONSUMER PRICE INDEX - OCTOBER 2026</h1>",
 "<p>The Consumer Price Index for All Urban Consumers (CPI-U) increased 0.4 percent on a seasonally adjusted basis in October",
 "after rising 0.6 percent in September, the U.S. Bureau of Labor Statistics reported today.</p>",
 "<p>The index for all items less food and energy rose 0.3 percent in October, as it did in September and August.</p>",
 "<p>October 2026 12-Month Percent Changes</p>",
 "<p>BLS did not collect survey data for October 2025 because of a lapse in appropriations.",
 "BLS cannot publish 12-month percent changes for October 2026 for indexes where October 2025 data are unavailable.</p></html>"
].join(" ");
const input={body,referencePeriod:"October 2026",sourceUrl,releaseDate};
const summary="Headline CPI +0.4% m/m; y/y unavailable (BLS); Core +0.3% m/m; y/y unavailable (BLS)";

test("published BLS October monthly CPI does not become fabricated annual CPI",()=>{
 assert.deepEqual(parseBlsMonthlyOnlyCpiOriginal(input),{actual:summary,sourceUrl});
 const rows=parseOfficialCpiMetricRows(summary);
 assert.deepEqual(rows.map(m=>[m.metric_key,m.actual]),[
  ["cpi_headline_mom",0.4],["cpi_core_mom",0.3],
 ]);
 assert.ok(rows.every(m=>m.transformation==="mom"));
 assert.equal(parseOfficialCpiMetricRows("Headline CPI +0.4% m/m; +0.0% y/y; Core +0.3% m/m; +0.0% y/y").length,4);
});
test("BLS fallback rejects source, publication or reference period spoofing",()=>{
 assert.equal(parseBlsMonthlyOnlyCpiOriginal({...input,sourceUrl:"https://untrusted.example/cpi"}),null);
 assert.equal(parseBlsMonthlyOnlyCpiOriginal({...input,sourceUrl:"https://www.bls.gov/news.release/archives/cpi_10142026.htm"}),null);
 assert.equal(parseBlsMonthlyOnlyCpiOriginal({...input,referencePeriod:"September 2026"}),null);
 assert.equal(parseBlsMonthlyOnlyCpiOriginal({...input,body:body.replace("BLS cannot publish","Analyst cannot publish")}),null);
 assert.equal(parseBlsMonthlyOnlyCpiOriginal({...input,body:body.replace("BLS cannot publish 12-month percent changes for October 2026","BLS cannot publish 12-month percent changes for November 2026")}),null);
 assert.equal(parseBlsMonthlyOnlyCpiOriginal({...input,body:body.replace("rose 0.3 percent","rose 39.3 percent")}),null);
 assert.ok(isSameOriginalBlsArchive(sourceUrl,sourceUrl));
 assert.equal(isSameOriginalBlsArchive(sourceUrl,sourceUrl+"?ref=wrong"),false);
});
test("missing BLS year-ago points retry from exact publisher original, not a vendor guess",async()=>{
 const release={
  id:"us-bls-2026-11-10-cpi-october-2026",
  release_name:"Consumer Price Index for October 2026",
  agency:"U.S. Bureau of Labor Statistics",
  release_date:releaseDate,
  reference_period:"October 2026",
  actual:null,status:"released_pending_ingestion",
  source_url:"https://www.bls.gov/schedule/2026/11_sched_list.htm",
 };
 const called:string[]=[];
 const fake=(async(url:RequestInfo|URL)=>{
  called.push(String(url));
  if(String(url).startsWith("https://api.bls.gov/publicAPI/"))
   return new Response(JSON.stringify({status:"REQUEST_SUCCEEDED",Results:{series:[]}}),{status:200});
  if(String(url)===sourceUrl)return new Response(body,{status:200});
  throw new Error("UNEXPECTED_HTTP_ROUTE");
 }) as typeof fetch;
 const resolved=await resolveOfficialActual(release,fake);
 assert.equal(resolved.actual,summary);
 assert.equal(resolved.sourceUrl,sourceUrl);
 assert.ok(called.some(url=>url===sourceUrl));
 assert.ok(called.some(url=>url.startsWith("https://api.bls.gov/")));
});
test("verified incomplete CPI remains partial and flags an operational data gap",()=>{
 const release={
  id:"us-bls-2026-11-10-cpi-october-2026",
  release_name:"Consumer Price Index for October 2026",
  release_date:releaseDate,
  agency:"U.S. Bureau of Labor Statistics",
  reference_period:"October 2026",
  source_url:sourceUrl,source_classification:"official_government",
  status:"completed",ingestion_attempt_status:"completed",
  actual:summary,released_at:releaseDate,actual_retrieved_at:"2026-11-24T15:00:00Z",
 };
 const metrics=parseOfficialCpiMetricRows(summary).map(m=>({
  ...m,release_id:release.id,source_url:sourceUrl,retrieved_at:"2026-11-24T15:00:00Z",
 }));
 const result=projectUsEconStatWatch({releases:[release],metrics,
  now:new Date("2026-11-24T16:00:00Z")});
 assert.equal(result.latest[0].status,"PARTIAL_METRICS");
 assert.equal(result.countVerified,0);
 assert.ok(result.warnings.includes("PARTIAL_OFFICIAL_METRICS:"+release.id));
 assert.ok(result.latest[0].metrics.every(x=>x.key.endsWith("_mom")));
 assert.equal(result.latest[0].actualText,summary);
});
