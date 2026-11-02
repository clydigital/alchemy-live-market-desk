import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {marketObservationTakeaway} from "../lib/bluebelly-market-observation-takeaway.ts";
import {selectTodayNewsroomItems} from "../lib/bluebelly-public-newsroom-feed.ts";
import type {PublicMarketObservation} from "../lib/blue-desk-public-markets.ts";
import type {NewsroomEditorialItem} from "../lib/bluebelly-newsroom-editorial.ts";
const file=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

const base:PublicMarketObservation={
 id:"spx",symbol:"SPX",label:"S&P 500",type:"Major Index",last:7000,
 change:2.15,change3d:1.67,change5d:-0.6,changeUnit:"%",asOf:"2026-11-02",
 frequency:"daily",sourceName:"Original market data",sourceUrl:"https://example.org/market/spx",
};

test("observed price direction is numerical only, with the exact window and no event attribution",()=>{
 const up=marketObservationTakeaway(base,"1D");
 assert.equal(up.state,"DATED_OBSERVATION");
 assert.match(up.observation,/S&P 500 \(SPX\) moved \+2\.15% over 1D/);
 assert.match(up.observation,/through source session 2026-11-02/);
 assert.match(up.observation,/not a verified reaction/);
 assert.doesNotMatch(up.observation,/earnings caused|priced in|risk premium fell/);
 const down=marketObservationTakeaway(base,"5D");
 assert.match(down.observation,/-0\.60% over 5D/);
 const rates=marketObservationTakeaway({...base,id:"us2y",symbol:"US02Y",type:"Rates",change:-12.75,changeUnit:"bp"},"1D");
 assert.match(rates.observation,/-12\.75 basis points/);
 assert.match(rates.nextTest,/inflation and monetary-policy expectations/);
});
test("unavailable, stale or non-daily records do not fabricate market observations",()=>{
 for(const item of [
  {...base,last:null},{...base,change:null},{...base,change:Infinity},
  {...base,asOf:null},{...base,frequency:"monthly" as const},
  {...base,dataStatus:"UNAVAILABLE_OR_STALE" as const},
 ]){
  const result=marketObservationTakeaway(item,"1D");
  assert.equal(result.state,"NOT_MEASURED");
  assert.match(result.observation,/unavailable or stale/);
 }
});
test("reviewed Newsroom explanation reaches Today automatically; source-only stays distinct",()=>{
 const now=new Date("2026-11-02T18:30:00Z");
 const editorial:NewsroomEditorialItem={
  id:"economy",headline:"Source-reviewed data and market stakes",summary:"Original reported facts",
  occurredAt:"2026-11-02T15:00:00Z",sourceName:"Official economic release",
  sourceUrl:"https://example.org/economy/release",readerHref:"/key-stories?brief=economy",
  topics:["policy"],verificationLabel:"REVIEWED ECONOMIC RELEASE",
  why:"A rise in costs could squeeze company margins if it persists.",
  nextTest:"Check the follow-on original prices and consumer data.",
  kind:"macro",
 };
 const t=selectTodayNewsroomItems([],[],[editorial],now,"bluebelly-desk.vercel.app",5);
 assert.equal(t.length,1);
 assert.equal(t[0].takeawayWhy,editorial.why);
 assert.equal(t[0].takeawayTest,editorial.nextTest);
 assert.equal(t[0].readerHref,editorial.readerHref);
});
test("Newsroom, Today and Markets show Market takeaway without creating a public interpretation engine",()=>{
 const brief=file("components/blue-desk/MarketTakeaway.tsx");
 const news=file("components/blue-desk/BluebellyNewsWire.tsx");
 const today=file("components/blue-desk/TodayNewsroomFeed.tsx");
 const markets=file("app/blue-desk/markets/page.tsx");
 const screener=file("components/blue-desk/PublicMarketScreener.tsx");
 const instrument=file("components/blue-desk/MarketObservationTakeaway.tsx");
 const research=file("components/blue-desk/PublishedResearchDispatches.tsx");
 assert.match(brief,/Market takeaway/);
 assert.match(brief,/mode==="reviewed"/);
 assert.match(brief,/Impact not yet assessed/);
 assert.match(brief,/What would clarify this/);
 assert.match(brief,/“priced in” verdict needs separate event-window/);
 assert.match(news,/MarketTakeaway why=\{card\.item\.why\} nextTest=\{card\.item\.nextTest\}/);
 assert.match(news,/<MarketTakeaway mode="source-only"/);
 assert.match(news,/<MarketTakeaway mode="archived"/);
 assert.match(today,/<MarketTakeaway why=\{entry\.takeawayWhy\} nextTest=\{entry\.takeawayTest\}/);
 assert.match(markets,/<MarketTakeaway why=\{focus\.mechanism\} nextTest=\{focus\.test\}/);
 assert.match(markets,/<MarketTakeaway why=\{participation\.interpretation\} nextTest=\{participation\.nextTest\}/);
 assert.match(screener,/<MarketObservationTakeaway row=\{row\} window=\{window\}/);
 assert.match(instrument,/data-market-observation-takeaway=\{brief\.state\}/);
 assert.match(research,/data-market-takeaway="owner-reviewed-research"/);
 for(const s of [brief,news,today,markets,screener,instrument]){
  assert.doesNotMatch(s,/createSupabaseAdminClient|generateContent\(|callLLM\(|openai\.chat\.completions/);
 }
});
test("black-first background with distinct colored category headings preserves selectable theme accents",()=>{
 const tokens=file("app/bluebelly-tokens.css");
 const news=file("components/blue-desk/bluebelly-newswire.module.css");
 const market=file("app/blue-desk/markets/legibility.module.css");
 const today=file("components/blue-desk/TodayNewsroomFeed.module.css");
 assert.match(tokens,/--bb-canvas:#050608/);
 assert.match(tokens,/--bb-heading-newsroom:#69c9ff/);
 assert.match(tokens,/--bb-heading-markets:#b6e9aa/);
 assert.match(tokens,/--bb-heading-today:#ffdb23/);
 for(const name of ["yellow-black","neon-blue","pastel-green","turquoise"])assert.ok(tokens.includes('data-bluebelly-theme="'+name+'"')||name==="yellow-black"&&tokens.includes('data-bluebelly-theme="yellow-black"'));
 assert.match(news,/\.item h2.*var\(--bb-heading-newsroom\)/);
 assert.match(market,/\.marketHero h1.*var\(--bb-heading-markets\)/);
 assert.match(today,/\.header h2.*var\(--bb-heading-today\)/);
});
