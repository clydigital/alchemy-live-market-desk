import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { selectStockMoveResearchTargets, stockMoveSearchResultMatches } from "../lib/stock-move-research-targets.ts";
import { applyHighImpactMarketDiscovery } from "../lib/high-impact-market-discovery.ts";
import type { MarketMonitorRow } from "../lib/market-monitor.ts";
import type { ResearchRunInput } from "../lib/research-update.ts";

const now=new Date("2026-10-22T09:00:00Z");
function row(symbol:string,dayChange:number|null,patch:Partial<MarketMonitorRow>={}): MarketMonitorRow {
  return {
    id:symbol.toLowerCase(), symbol,label:symbol,type:"AI / Semis",
    benchmark:"ndx",last:100,previousClose:98,sessionOpen:99,
    dayChange,gapChange:0,change3d:-3,change5d:-5,rsi:35,stochRsi:22,
    volPercentile:90,relative5d:-4,attentionScore:74,
    hot:true,contradiction:false,tags:["HIGH VOL"],asOf:"2026-10-21",
    frequency:"daily",sourceName:"Nasdaq source",sourceUrl:"https://data.nasdaq.com/api/history",
    points:[{time:1792368000,close:105},{time:1792454400,close:102},{time:1792540800,close:100}],
    ...patch,
  };
}
function base():ResearchRunInput {
 return {runKey:"move-test",scheduleSlot:"evening",scheduledFor:now.toISOString(),sourceChecks:[],items:[]};
}
const eligible=[
 row("CRWV",-8.2,{attentionScore:90}),row("NVDA",5.4,{attentionScore:82}),
 row("ARM",-4.6,{attentionScore:73}),row("ORCL",-4.2,{attentionScore:71}),
];

test("large sourced stock moves become at most three highest-priority investigation queries",()=>{
  const selections=selectStockMoveResearchTargets({rows:eligible},now);
  assert.deepEqual(selections.map(s=>s.symbol),["CRWV","NVDA","ARM"]);
  assert.equal(selections.length,3);
  for(const s of selections){
    assert.match(s.key,/^stock-move-/);
    assert.equal(s.materiality,65,"An observed price move is not news materiality");
    assert.match(s.signal,/UNVERIFIED/);
    assert.match(s.query,/earnings OR guidance/);
    assert.equal(s.asOf,"2026-10-21");
    assert.match(s.sourceUrl,/https:/);
  }
});

test("stale/missing source, ETF, monthly, tiny moves, future clocks and nonstock proxies are excluded",()=>{
  const all=[
    row("NVDA",null,{change5d:4,gapChange:0}),
    row("NVDA",-6,{frequency:"monthly"}),
    row("NVDA",-9,{asOf:"2026-10-14"}),
    row("NVDA",-7,{asOf:"2026-10-28"}),
    row("NVDA",-7,{sourceUrl:"http://untrusted.example/history"}),
    row("NVDA",-7,{points:[]}),
    row("SPY",-9),row("SOXX",-7),row("XLK",-8),row("CL=F",-12),
    row("ORCL",null,{gapChange:-3.2,change5d:0}),
  ];
  assert.deepEqual(selectStockMoveResearchTargets({rows:all},now).map(x=>x.symbol),["ORCL"]);
  assert.equal(selectStockMoveResearchTargets({rows:eligible},new Date("2026-11-12T09:00:00Z")).length,0);
});
test("search article must mention the actual investigated issuer",()=>{
 const targets=selectStockMoveResearchTargets({rows:eligible},now);
 assert.equal(stockMoveSearchResultMatches(targets[0],"CoreWeave shares slump after earnings"),true);
 assert.equal(stockMoveSearchResultMatches(targets[1],"NVIDIA updates its outlook"),true);
 assert.equal(stockMoveSearchResultMatches(targets[1],"Energy stocks rally on oil prices"),false);
 assert.equal(stockMoveSearchResultMatches(targets[0],"Core weaker than peers"),false);
});

test("move-triggered reporting is a monitor-only original news lead; never verified causal Motion",async()=>{
 const move=selectStockMoveResearchTargets({rows:[eligible[0]]},now);
 const source="https://www.reuters.com/technology/coreweave-shares-slide-on-fresh-report-2026-10-21/";
 const calls:string[]=[];
 const fetchImpl=(async (request:RequestInfo|URL)=>{
   const url=String(request);calls.push(url);
   if(url.startsWith("https://api.gdeltproject.org/")) {
     const q=new URL(url).searchParams.get("query")||"";
     if(q.includes("CoreWeave")) return new Response(JSON.stringify({articles:[
       {title:"CoreWeave shares slide as investors assess funding risk",url:source,seendate:"20261021T150000Z"},
       {title:"Unrelated macro markets lower",url:"https://example.org/unrelated",seendate:"20261021T140000Z"},
     ]}),{status:200,headers:{"content-type":"application/json"}});
     return new Response("unavailable",{status:503,headers:{"content-type":"text/plain"}});
   }
   if(url===source) return new Response(
    "<html><head><meta name='description' content='Investors analysed financing risks after the company released a current corporate update and market watchers examined the latest disclosures.'></head></html>",
    {status:200,headers:{"content-type":"text/html"}});
   return new Response("not found",{status:404});
 }) as typeof fetch;
 const out=await applyHighImpactMarketDiscovery(base(),"evening",{now,fetchImpl,stockMoveTargets:move});
 assert.equal(out.items.length,1);
 assert.equal(out.items[0].url,source);
 assert.equal(out.items[0].recommendedAction,"monitor");
 assert.equal(out.items[0].materiality,65);
 assert.match(out.items[0].statsSignal||"",/day=-8.2%/);
 assert.match(out.items[0].newsSignal||"",/UNVERIFIED/);
 assert.match(out.items[0].divergenceNote||"",/Cause NOT VERIFIED/);
 assert.match(out.summary||"",/stock-move-crwv=leads_found/);
 assert.ok(calls.some(x=>x.startsWith("https://api.gdeltproject.org/")));
 assert.ok(calls.some(x=>x===source));
});

test("no new scheduler or private mutation, existing source-dated market monitor is used",()=>{
  const runner=readFileSync(new URL("../lib/firecrawl-scheduled-research.ts",import.meta.url),"utf8");
  const baseSource=readFileSync(new URL("../lib/market-monitor-public.ts",import.meta.url),"utf8");
  const research=readFileSync(new URL("../lib/high-impact-market-discovery.ts",import.meta.url),"utf8");
  assert.match(runner,/getMarketMonitor\(\)/);
  assert.match(runner,/selectStockMoveResearchTargets\(monitor, now\)/);
  assert.match(research,/recommendedAction: "monitor"/);
  assert.match(research,/Cause NOT VERIFIED/);
  assert.match(baseSource,/frequency !== "daily"/);
  assert.doesNotMatch(runner,/persistMarketMotion|new Scheduler|insert\(/);
});
