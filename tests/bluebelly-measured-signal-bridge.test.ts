import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {buildMarketDivergenceWatch} from "../lib/bluebelly-market-divergence-watch.ts";
import {selectMeasuredMarketSignals} from "../lib/bluebelly-measured-market-signals.ts";
import {buildSignalRadar} from "../lib/bluebelly-signal-radar.ts";
import {filterNewsBySignal,newsResearchTags,normaliseNewsSignalFilter} from "../lib/bluebelly-news-signal-filter.ts";
import type {PublicMarketObservation} from "../lib/blue-desk-public-markets.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const row=(symbol:string,change:number,asOf="2026-11-12"):PublicMarketObservation=>({
 id:symbol,symbol,label:symbol,type:"Sector",last:100,change,change3d:change*2,change5d:change*3,
 asOf,frequency:"daily",changeUnit:"%",sourceName:"Verified daily close",sourceUrl:"https://market.example/"+symbol,
});
const now=new Date("2026-11-13T01:00:00Z");
const tape=(a:number,b:number,day="2026-11-12")=>buildMarketDivergenceWatch([row("SMH",a,day),row("QQQ",b,day)],"1D");

test("opposite price movements receive measured-only divergence, dual dated links and precise pp gap",()=>{
 const signals=selectMeasuredMarketSignals(tape(-2.4,1.2),"1D",now);
 assert.equal(signals.length,1);
 const d=signals[0];
 assert.equal(d.id,"semis-vs-nasdaq");
 assert.equal(d.status,"OPPOSITE_MOVE");
 assert.equal(d.sourceSession,"2026-11-12");
 assert.equal(d.leftChange,-2.4);
 assert.equal(d.rightChange,1.2);
 assert.equal(d.gapPp,-3.6);
 assert.equal(d.tag.id,"divergence");
 assert.equal(d.tag.state,"MEASURED_RELATIVE");
 assert.notEqual(d.leftSourceUrl,d.rightSourceUrl);
});
test("same-sign small performance gaps cannot be called measured anomalies",()=>{
 assert.equal(selectMeasuredMarketSignals(tape(1.1,.3),"1D",now).length,0);
 const large=selectMeasuredMarketSignals(tape(4.1,.8),"1D",now);
 assert.equal(large.length,1);
 assert.equal(large[0].status,"RELATIVE_MOVE");
});
test("stale, future, mismatched, unknown or unsigned sources never enter the radar",()=>{
 const stale=selectMeasuredMarketSignals(tape(-2,3,"2026-11-05"),"1D",now);
 assert.equal(stale.length,0);
 const future=selectMeasuredMarketSignals(tape(-2,3,"2026-11-20"),"1D",now);
 assert.equal(future.length,0);
 const shifted=buildMarketDivergenceWatch([row("SMH",-2),row("QQQ",3,"2026-11-11")],"1D");
 assert.equal(selectMeasuredMarketSignals(shifted,"1D",now).length,0);
 const missing=buildMarketDivergenceWatch([{...row("SMH",-2),sourceUrl:null},row("QQQ",3)],"1D");
 assert.equal(selectMeasuredMarketSignals(missing,"1D",now).length,0);
 const bad=buildMarketDivergenceWatch([{...row("SMH",-2),sourceUrl:"javascript:alert(1)"},row("QQQ",3)],"1D");
 assert.equal(selectMeasuredMarketSignals(bad,"1D",now).length,0);
 const unavailable=buildMarketDivergenceWatch([{...row("SMH",-2),dataStatus:"UNAVAILABLE_OR_STALE"},row("QQQ",3)],"1D");
 assert.equal(selectMeasuredMarketSignals(unavailable,"1D",now).length,0);
});
test("Regime radar reserves bounded measured market space, preserves source checks and limits",()=>{
 const sourceFeed=[];const readings=tape(-3.1,1.7);
 const radar=buildSignalRadar(sourceFeed,now,12,readings,"1D");
 assert.equal(radar.length,1);
 assert.equal(radar[0].verification,"MEASURED MARKET GAP");
 assert.equal(radar[0].tags[0].state,"MEASURED_RELATIVE");
 assert.ok(radar[0].href.includes("/markets?mode=watch&window=1D"));
 assert.equal(radar[0].measured?.gapPp,-4.8);
 assert.ok(radar[0].secondarySource?.url.includes("/QQQ"));
 const old=buildSignalRadar(sourceFeed,now,12,readings,"1D");assert.equal(old.length,radar.length);
});
test("Newsroom signal filters require a source-only news brief and never infer a bargain",()=>{
 const entry=(headline:string,summary:string):NewsBriefV1=>({
 contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",id:headline,
 headline,summary,sourceName:"Source",sourceUrl:"https://news.example/report",sourceKind:"reporting",
 occurredAt:"2026-11-12T10:00:00Z",observedAt:"2026-11-12T11:00:00Z",verification:"SOURCE_VERIFIED"
 });
 const data=[
  entry("AI revenue rises while financing costs climb",
   "A dated filing shows stronger revenue even as financing charges rise in the same fiscal period."),
  entry("Fed inflation policy rates shift after CPI release",
   "Official rates shift in the inflation report; market participants await the next FOMC decision."),
  entry("Stock price falls 50%, investors call it undervalued",
   "Some investors see a bargain, but no independent fair-value comparison is provided.")
 ];
 assert.equal(normaliseNewsSignalFilter("divergence"),"divergence");
 assert.equal(normaliseNewsSignalFilter("misprice"),"all");
 assert.equal(filterNewsBySignal(data,"divergence").length,1);
 assert.equal(filterNewsBySignal(data,"mispricing").length,0);
 assert.equal(filterNewsBySignal(data,"all").length,3);
 assert.ok(!newsResearchTags(data[2]).some(t=>t.id==="mispricing"));
});
test("the live pages use a typed measured market bridge and preserve owner-only privacy",()=>{
 const pub=read("app/blue-desk/regime-watch/page.tsx");
 const ps=read("app/power-stack/page.tsx");
 const news=read("components/blue-desk/BluebellyNewsWire.tsx");
 const newsPage=read("app/blue-desk/newsroom/page.tsx");
 const privatePanel=read("components/blue-desk/PowerStackMeasuredSignals.tsx");
 const market=read("components/blue-desk/MarketDivergenceWatch.tsx");
 assert.match(pub,/buildMarketDivergenceWatch\(publicMarketObservations\(monitor\?\.rows\?\?\[\],"all"\),"1D"\)/);
 assert.match(pub,/buildSignalRadar\(topicReasons,now,12,measuredMarket,"1D"\)/);
 assert.match(ps,/createSupabaseServerClient/);
 assert.ok(ps.indexOf('getMarketMonitor().catch')>ps.indexOf('if (allowError || !allowed) redirect'));
 assert.match(ps,/ready\?<PowerStackMeasuredSignals/);
 assert.match(privatePanel,/trackedTickers/);
 assert.match(market,/selectMeasuredMarketSignals\(reads,window,new Date\(\),5\)/);
 assert.match(news,/filterNewsBySignal\(visible,signal\)/);
 assert.match(news,/data-newsroom-signal-filter="source-only-news"/);
 assert.match(news,/signal"\);else url.searchParams.set\("signal"/);
 assert.match(newsPage,/initialSignal=\{typeof params.signal/);
 assert.doesNotMatch(pub,/power_stack_owner_snapshots|trackedTickers/);
 assert.ok(![".insert(", ".update(", ".upsert("].some(token=>privatePanel.includes(token)));
});
