import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";

import {
  BLS_TREND_SERIES, officialBlsTrendRecords, collectOfficialMacroTrendHistory,
} from "../lib/official-macro-trend-history.ts";

type Datum={year:string;period:string;value:string};
const datum=(year:number,month:number,value:number):Datum=>({
  year:String(year),period:"M"+String(month).padStart(2,"0"),value:String(value),
});
const historical=(priorYear:number,priorMonth:number,aug:number,sept:number)=>[
  datum(2025,9,priorYear),datum(2026,7,priorMonth),
  datum(2026,8,aug),datum(2026,9,sept),
  datum(2026,11,9999),
  {year:"2026",period:"M13",value:"400"},
];
const payload={
  status:"REQUEST_SUCCEEDED",Results:{series:[
    {seriesID:"CUSR0000SA0",data:historical(100,200,210,220)},
    {seriesID:"CUUR0000SA0",data:historical(98,205,215,225)},
    {seriesID:"CUSR0000SA0L1E",data:historical(110,300,303,306)},
    {seriesID:"CUUR0000SA0L1E",data:historical(115,310,314,319)},
    {seriesID:"WPSFD4",data:historical(80,190,195,205)},
    {seriesID:"WPUFD4",data:historical(85,192,198,211)},
    {seriesID:"CES0000000001",data:historical(130000,150000,150040,150080)},
  ]},
};
const now=new Date("2026-10-21T14:30:00Z");

test("BLS observation mapper uses SA m/m and NSA y/y, protects monthly grain and keeps history dated",()=>{
  const rows=officialBlsTrendRecords(payload,now);
  const item=(key:string)=>rows.find(r=>r.id===key);
  assert.equal(item("cpi_all-2026-09")?.value,220);
  assert.equal(item("cpi_all-2026-09")?.mom_change,4.762);
  assert.equal(item("cpi_all-2026-09")?.yoy_change,129.592);
  assert.equal(item("cpi_core-2026-09")?.mom_change,0.99);
  assert.equal(item("cpi_core-2026-09")?.yoy_change,177.391);
  assert.equal(item("ppi_final_demand-2026-09")?.value,205);
  assert.equal(item("ppi_final_demand-2026-09")?.mom_change,5.128);
  assert.equal(item("nfp-2026-09")?.value,40);
  assert.equal(item("nfp-2026-09")?.mom_change,null);
  assert.equal(item("nfp-2026-09")?.unit,"Thousands of jobs, m/m change");
  assert.equal(item("nfp-2026-09")?.series_id,"CES0000000001_CHANGE");
  assert.ok(rows.every(r=>r.source_url.startsWith("https://data.bls.gov/timeseries/")));
  assert.ok(!rows.some(r=>r.observation_date>"2026-10-21"||r.observation_date.endsWith("11-01")));
  assert.equal(BLS_TREND_SERIES.length,7);
  assert.deepEqual(officialBlsTrendRecords({status:"REQUEST_FAILED"},now),[]);
});

test("official trend ingestion runs idempotently, never rewrites an existing legacy vintage",async()=>{
  const known=new Set<string>(["cpi_all-2026-08"]);
  const inserted:string[]=[];
  const store={
    async existingIds(ids:string[]){return new Set(ids.filter(id=>known.has(id)));},
    async insertMissing(rows:Array<{id:string}>){
      for(const row of rows){assert.ok(!known.has(row.id));known.add(row.id);inserted.push(row.id);}
      return rows.length;
    },
  };
  const fetcher=(async(_url:string,init?:RequestInit)=>{
    assert.equal(init?.method,"POST");
    const body=JSON.parse(String(init?.body));
    assert.deepEqual(body.seriesid,BLS_TREND_SERIES.map(s=>s.id));
    assert.equal(body.startyear,"2024");
    return new Response(JSON.stringify(payload),{status:200});
  }) as typeof fetch;
  const first=await collectOfficialMacroTrendHistory(now,{fetcher,store});
  assert.equal(first.status,"READY");
  assert.ok(first.insertedRecords>0);
  assert.equal(first.insertedRecords,first.eligibleRecords-1);
  assert.ok(first.coveredSeries.includes("nfp"));
  assert.ok(first.latestBySeries.cpi_all==="2026-09-01");
  const second=await collectOfficialMacroTrendHistory(now,{fetcher,store});
  assert.equal(second.status,"READY");
  assert.equal(second.insertedRecords,0);
  assert.equal(inserted.length,first.insertedRecords);
});

test("provider outage or missing official series is degraded, not a fabricated flat trend",async()=>{
  const broken=await collectOfficialMacroTrendHistory(now,{
    fetcher:(async()=>new Response("error",{status:429})) as typeof fetch,
    store:{existingIds:async()=>new Set(),insertMissing:async()=>{throw Error("unexpected");}},
  });
  assert.equal(broken.status,"DEGRADED");
  assert.ok(broken.warnings.includes("BLS_API_HTTP_429"));
  assert.equal(broken.insertedRecords,0);
  const partial=await collectOfficialMacroTrendHistory(now,{
    fetcher:(async()=>new Response(JSON.stringify({status:"REQUEST_SUCCEEDED",Results:{series:[payload.Results.series[0]]}}))) as typeof fetch,
    store:{existingIds:async()=>new Set(),insertMissing:async rows=>rows.length},
  });
  assert.equal(partial.status,"DEGRADED");
  assert.equal(partial.coveredSeries.length,1);
});

test("existing scheduled Live research slot owns new trend-history intake, not a second scheduler",()=>{
  const cron=readFileSync(new URL("../lib/cron-research-handler.ts",import.meta.url),"utf8");
  assert.match(cron,/collectOfficialMacroTrendHistory/);
  assert.match(cron,/event:"scheduled_macro_trend_history"/);
  assert.match(cron,/macroTrends,/);
  assert.ok(cron.indexOf("const macroTrends: MacroTrendRefresh")<cron.indexOf("const publication = await"));
  const macro=readFileSync(new URL("../app/data/macro/page.tsx",import.meta.url),"utf8");
  assert.match(macro,/<MacroTrendMonitor observations=\{data\.macroObservations\}/);
  assert.match(macro,/<AutoRefreshMacroData \/>/);
  const refresh=readFileSync(new URL("../components/live-desk/AutoRefreshMacroData.tsx",import.meta.url),"utf8");
  assert.match(refresh,/document\.visibilityState === "visible"/);
  assert.match(refresh,/router\.refresh\(\)/);
});
