import test from "node:test";
import assert from "node:assert/strict";
import {
 parseOfficialWpsrCsv,fetchOfficialWpsrCsv,
 WPSR_CSV_TABLE1,WPSR_CSV_TABLE9
} from "../lib/providers/eia-wpsr-csv.ts";
import {fetchEiaWeeklyPetroleumSnapshot,EIA_WEEKLY_SERIES} from "../lib/providers/eia-v2.ts";

/** Shape and row names transcribed from the EIA 23 Oct 2026 original WPSR
 * Table 1 and Table 9 CSV; not inferred from the API JSON route. */
const week1=[
 '"STUB_1","10/23/26","10/16/26","Difference","Percent Change","10/24/25","Difference","Percent Change"',
 '"Crude Oil","693.208","695.200","-1.992","-0.300","825.063","-131.855","-16.000"',
 '"Commercial (Excluding SPR)","410.625","412.517","-1.892","-0.500","415.966","-5.341","-1.300"',
 '"Strategic Petroleum Reserve (SPR)","282.583","282.683","-0.100","0.000","409.097","-126.514","-30.900"',
 '"Total Motor Gasoline","209.180","205.310","3.870","1.900","210.738","-1.558","-0.700"',
 '"Distillate Fuel Oil","102.824","104.286","-1.462","-1.400","112.189","-9.365","-8.300"',
 '"STUB_1","STUB_2","10/23/26","10/16/26","Difference","10/24/25","Difference","10/23/26","10/24/25","Percent Change"',
 '"Crude Oil Supply ","(1)     Domestic Production","13,992","13,269","723","13,644","348"',
 '"Products Supplied ","(31)     Finished Motor Gasoline","8,358","8,982","-625","8,924","-566"',
].join("\r\n")+"\r\n";
const week9=[
 '"STUB_1","STUB_2","10/23/26","10/16/26","10/24/25","10/25/24","10/23/26","10/24/25"',
 '"Crude Oil Production ","Domestic Production","13,992","13,269","13,644","13,500","13,730","13,635"',
 '"Refiner Inputs and Utilization ","Crude Oil Inputs","16,526","16,649","15,219","16,053","16,567","15,594"',
 '"Refiner Inputs and Utilization ","Percent Utilization","92.8","93.4","86.6","89.1","93.1","88.3"',
].join("\r\n")+"\r\n";

test("WPSR 23 Oct original CSV rows return all eight metric IDs, true weeks and canonical units",()=>{
 const snap=parseOfficialWpsrCsv(week1,week9,"2026-10-28T14:30:00Z");
 assert.equal(snap.state,"ready");
 assert.equal(snap.asOf,"2026-10-23");
 assert.equal(snap.retrievedAt,"2026-10-28T14:30:00Z");
 assert.equal(snap.sourceUrl,WPSR_CSV_TABLE1);
 assert.equal(Object.keys(snap.metrics).length,8);
 assert.deepEqual(Object.keys(snap.metrics).sort(),Object.keys(EIA_WEEKLY_SERIES).sort());
 assert.equal(snap.metrics.crudeStocksExSpr?.latest.value,410625);
 assert.equal(snap.metrics.crudeStocksExSpr?.previous?.value,412517);
 assert.equal(snap.metrics.crudeStocksExSpr?.latest.units,"MBBL");
 assert.equal(snap.metrics.sprStocks?.latest.value,282583);
 assert.equal(snap.metrics.gasolineStocks?.latest.value,209180);
 assert.equal(snap.metrics.distillateStocks?.latest.value,102824);
 assert.equal(snap.metrics.crudeProduction?.latest.value,13992);
 assert.equal(snap.metrics.crudeProduction?.latest.units,"MBBL/D");
 assert.equal(snap.metrics.gasolineProductSupplied?.latest.value,8358);
 assert.equal(snap.metrics.refineryCrudeInputs?.latest.value,16526);
 assert.equal(snap.metrics.refineryUtilisation?.latest.value,92.8);
 assert.equal(snap.metrics.refineryUtilisation?.latest.units,"%");
 assert.equal(snap.metrics.refineryUtilisation?.previous?.period,"2026-10-16");
 assert.match(snap.note||"",/OFFICIAL_WPSR_CSV: 8\/8/);
});
test("WPSR fails closed on malformed dates, missing labels, duplicate national rows and mismatched weeks",()=>{
 const dateChanged=week9.replaceAll("10/23/26","10/16/26");
 const mismatch=parseOfficialWpsrCsv(week1,dateChanged,"2026-10-31T08:00:00Z");
 assert.equal(Object.keys(mismatch.metrics).length,6);
 assert.equal(mismatch.metrics.refineryUtilisation,undefined);
 assert.match(mismatch.note||"",/week mismatch/);
 const dup=parseOfficialWpsrCsv(week1.replace('"STUB_1","STUB_2"', '"Commercial (Excluding SPR)","410.625","412.517"\r\n"STUB_1","STUB_2"'),week9,"2026-10-31T08:00:00Z");
 assert.equal(dup.metrics.crudeStocksExSpr,undefined);
 const wrong=parseOfficialWpsrCsv(week1.replaceAll("Domestic Production","Unrelated Production"),week9,"2026-10-31T08:00:00Z");
 assert.equal(wrong.metrics.crudeProduction,undefined);
 const bad=parseOfficialWpsrCsv(week1.replaceAll("10/23/26","10/24/26"),week9,"2026-10-31T08:00:00Z");
 assert.equal(bad.state,"unavailable");
 const nonNumeric=parseOfficialWpsrCsv(week1.replace("410.625","– –"),week9,"2026-10-31T08:00:00Z");
 assert.equal(nonNumeric.metrics.crudeStocksExSpr,undefined);
 assert.equal(parseOfficialWpsrCsv("<html>not a csv</html>",week9,"2026-10-31T08:00:00Z").state,"unavailable");
});
test("keyless original CSV transport fetch is pinned to official source and no credentials",async()=>{
 const seen:string[]=[];
 const fetchImpl=async(url:RequestInfo|URL)=>{
  seen.push(String(url));
  return new Response(String(url).endsWith("table1.csv")?week1:week9,{status:200});
 };
 const snap=await fetchOfficialWpsrCsv({fetchImpl:fetchImpl as typeof fetch});
 assert.equal(snap.state,"ready");
 assert.equal(Object.keys(snap.metrics).length,8);
 assert.deepEqual(seen.sort(),[WPSR_CSV_TABLE1,WPSR_CSV_TABLE9].sort());
 assert.ok(seen.every(url=>!url.includes("api_key")));
});
test("invalid API key falls back to official CSV without impersonating API success",async()=>{
 const seen:string[]=[];
 const fetchImpl=async(input:RequestInfo|URL)=>{
  const url=String(input);seen.push(url);
  if(url===WPSR_CSV_TABLE1)return new Response(week1,{status:200});
  if(url===WPSR_CSV_TABLE9)return new Response(week9,{status:200});
  return new Response(JSON.stringify({error:{code:"API_KEY_INVALID",message:"secret-key"}}),{status:403});
 };
 const result=await fetchEiaWeeklyPetroleumSnapshot("secret-key",{fetchImpl:fetchImpl as typeof fetch});
 assert.equal(result.state,"ready");
 assert.equal(Object.keys(result.metrics).length,8);
 assert.equal(result.metrics.crudeStocksExSpr?.latest.value,410625);
 assert.equal(result.sourceUrl,WPSR_CSV_TABLE1);
 assert.match(result.note||"",/OFFICIAL_WPSR_CSV/);
 assert.match(result.note||"",/API_KEY_INVALID/);
 assert.equal(JSON.stringify(result).includes("secret-key"),false);
 assert.equal(seen.length,5);
});
test("complete API remains primary; stale CSV cannot overwrite fresher partial API",async()=>{
 const fullyMocked=async(input:RequestInfo|URL)=>{
  const u=new URL(String(input));
  if(u.hostname==="ir.eia.gov")throw new Error("CSV must not be called for complete API");
  const ids=u.searchParams.getAll("facets[series][]");
  return new Response(JSON.stringify({response:{data:ids.map(series=>({period:"2026-10-23",series,value:"100",units:"Thousand Barrels"}))}}),{status:200});
 };
 const primary=await fetchEiaWeeklyPetroleumSnapshot("key",{fetchImpl:fullyMocked as typeof fetch});
 assert.equal(primary.state,"ready");
 assert.equal(Object.keys(primary.metrics).length,8);
 assert.equal(primary.sourceUrl,"https://www.eia.gov/opendata/");
 const older1=week1.replaceAll("10/23/26","10/16/26").replaceAll("10/16/26","10/09/26");
 const older9=week9.replaceAll("10/23/26","10/16/26").replaceAll("10/16/26","10/09/26");
 const partial=async(input:RequestInfo|URL)=>{
  const u=new URL(String(input));
  if(u.href===WPSR_CSV_TABLE1)return new Response(older1,{status:200});
  if(u.href===WPSR_CSV_TABLE9)return new Response(older9,{status:200});
  if(u.pathname.includes("/pnp/wiup/"))return new Response("error",{status:503});
  const ids=u.searchParams.getAll("facets[series][]");
  return new Response(JSON.stringify({response:{data:ids.map(series=>({period:"2026-10-23",series,value:"100",units:"Thousand Barrels"}))}}),{status:200});
 };
 const retained=await fetchEiaWeeklyPetroleumSnapshot("key",{fetchImpl:partial as typeof fetch});
 assert.equal(Object.keys(retained.metrics).length,6);
 assert.equal(retained.asOf,"2026-10-23");
 assert.equal(retained.sourceUrl,"https://www.eia.gov/opendata/");
});
test("WPSR 403 never creates fabricated coverage",async()=>{
 const fetchImpl=async()=>new Response("Forbidden",{status:403});
 const snap=await fetchOfficialWpsrCsv({fetchImpl:fetchImpl as typeof fetch});
 assert.equal(snap.state,"unavailable");
 assert.equal(Object.keys(snap.metrics).length,0);
});
