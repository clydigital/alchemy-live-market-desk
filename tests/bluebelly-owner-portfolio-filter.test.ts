import assert from "node:assert/strict";
import test from "node:test";
import {filterPortfolioRows} from "../lib/bluebelly-owner-portfolio-filter.ts";
const holdings=[
 {ticker:"AAA",name:"Alpha",position:{quantity:10}},
 {ticker:"BBB",name:"Beta",position:{quantity:4}},
 {ticker:"CCC",name:"Gamma",position:{quantity:20}},
];
const prices=new Map([
 ["AAA",{last:12,change:3,change3d:4,change5d:5}],
 ["BBB",{last:9,change:-7,change3d:-4,change5d:8}],
]);
const symbols=(v:Array<{ticker:string}>)=>v.map(x=>x.ticker);
test("filters by name, ticker and quote coverage without dropping missing rows by default",()=>{
 assert.deepEqual(symbols(filterPortfolioRows(holdings,prices,"holdings",{})),["AAA","BBB","CCC"]);
 assert.deepEqual(symbols(filterPortfolioRows(holdings,prices,"holdings",{hs:"bEt"})),["BBB"]);
 assert.deepEqual(symbols(filterPortfolioRows(holdings,prices,"holdings",{hquote:"missing"})),["CCC"]);
 assert.deepEqual(symbols(filterPortfolioRows(holdings,prices,"holdings",{hquote:"priced"})),["AAA","BBB"]);
});
test("ascending losers and descending gainers keep missing observations last",()=>{
 assert.deepEqual(symbols(filterPortfolioRows(holdings,prices,"holdings",{hsort:"gain1d"})),["AAA","BBB","CCC"]);
 assert.deepEqual(symbols(filterPortfolioRows(holdings,prices,"holdings",{hsort:"loss1d"})),["BBB","AAA","CCC"]);
 assert.deepEqual(symbols(filterPortfolioRows(holdings,prices,"holdings",{hsort:"quantity"})),["CCC","AAA","BBB"]);
});
test("watchlist score, rank and theme sorting preserve eligible candidates",()=>{
 const watch=[
  {ticker:"Z",name:"Z",rank:4,score:83,theme:"Energy"},
  {ticker:"A",name:"A",rank:1,score:75,theme:"AI"},
  {ticker:"B",name:"B",rank:2,score:null,theme:"Energy"},
 ];
 assert.deepEqual(symbols(filterPortfolioRows(watch,new Map(),"watchlist",{})),["A","B","Z"]);
 assert.deepEqual(symbols(filterPortfolioRows(watch,new Map(),"watchlist",{wtheme:"Energy",wsort:"score"})),["Z","B"]);
 assert.deepEqual(symbols(filterPortfolioRows(watch,new Map(),"watchlist",{wsort:"alpha"})),["A","B","Z"]);
});
