import assert from "node:assert/strict";
import test from "node:test";
import {passesMarketSignalFilter} from "../lib/bluebelly-signal-filters.ts";
import type {PublicMarketObservation} from "../lib/blue-desk-public-markets.ts";

const base = {id:"x",label:"X",symbol:"X",type:"MAG7",last:10,change:1,change3d:2,
  change5d:3,changeUnit:"%" as const,asOf:"2026-11-09",frequency:"daily" as const,
  sourceName:"source",sourceUrl:"https://example.com"};
const filters = {family:"all" as const,bias:"bullish" as const,breakoutDays:"55" as const,minimumAligned:0};
test("plain market table still shows observations without scan",()=>{
  assert.equal(passesMarketSignalFilter(base as PublicMarketObservation,filters),true);
  assert.equal(passesMarketSignalFilter(base as PublicMarketObservation,{...filters,minimumAligned:2}),false);
});
test("one timeframe cannot award multiple breakout votes and missing data is excluded",()=>{
  const row={...base,screening:{asOf:"2026-11-09",breakout:{
    "20":{state:"up",basis:"high-low"},"55":{state:"up",basis:"high-low"},"252":{state:"unavailable",basis:null}},
    stoch:{k:10,d:20,zone:"oversold",turn:"none"},volume:{multiple:null,state:"unavailable"},
    relative:{excess20d:5,state:"leader"},squeeze:{state:"unavailable"},
    alignment:{bullish:{matched:2,available:3},bearish:{matched:0,available:3}}}} as unknown as PublicMarketObservation;
  assert.equal(passesMarketSignalFilter(row,{...filters,minimumAligned:2}),true);
  assert.equal(passesMarketSignalFilter(row,{...filters,minimumAligned:3}),false);
  assert.equal(passesMarketSignalFilter(row,{...filters,family:"breakout",breakoutDays:"252"}),false);
  assert.equal(passesMarketSignalFilter(row,{...filters,family:"stoch"}),true);
});
