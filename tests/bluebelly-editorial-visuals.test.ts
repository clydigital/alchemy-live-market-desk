import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MOTIFS, TV_INSTRUMENTS, editorialMotif, storyTvInstrument, TV_MARKET_GROUP_DEFAULTS } from "../lib/bluebelly-editorial-visuals.ts";
const file=(path: string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("11 stable first-party SVG motifs, including safe generic fallback",()=>{
  assert.equal(MOTIFS.length,11);
  assert.equal(editorialMotif("OpenAI unveils new inference chip"),"ai");
  assert.equal(editorialMotif("China tightens AI chip export rules"),"china");
  assert.equal(editorialMotif("Fed sets rate decision"),"fed");
  assert.equal(editorialMotif("Brent oil transport disruption"),"energy");
  assert.equal(editorialMotif("LNG terminal maintenance"),"lng");
  assert.equal(editorialMotif("Unknown surprising announcement"),"other");
  assert.match(file("components/blue-desk/EditorialStoryArt.tsx"),/NOT MARKET DATA/);
});

test("only exact, curated symbol contexts receive TradingView price charts",()=>{
  assert.equal(storyTvInstrument("US 10Y yield jumps"),"us10y");
  assert.equal(storyTvInstrument("Brent crude jumps"),"brent");
  assert.equal(storyTvInstrument("France OAT Bund spread widens"),null);
  assert.equal(storyTvInstrument("AI bubble speculation"),null);
  assert.equal(storyTvInstrument("Diesel crack spread expands"),null);
  for(const t of Object.values(TV_INSTRUMENTS)) assert.match(t.symbol,/^[A-Z0-9]+:[A-Z0-9]+$/);
  for(const key of Object.values(TV_MARKET_GROUP_DEFAULTS)) assert.ok(TV_INSTRUMENTS[key]);
});
test("public views use lazy official TradingView widgets and not generated price graphics",()=>{
  const c=file("components/blue-desk/TradingViewChart.tsx");
  const m=file("app/blue-desk/markets/page.tsx");
  assert.match(c,/widgets\.tradingview-widget\.com/);
  assert.match(c,/tv-advanced-chart/);
  assert.match(c,/!opened/);
  assert.match(c,/Open in TradingView/);
  assert.match(m,/TradingViewChart/);
});
