import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {projectHomeRadar} from "../lib/bluebelly-home-radar-intelligence.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";
import type {PublicMarketObservation} from "../lib/blue-desk-public-markets.ts";
import type {MarketDivergenceRead} from "../lib/bluebelly-market-divergence-watch.ts";

const now=new Date("2026-11-24T00:00:00.000Z");
const recent="2026-11-23T21:00:00.000Z";
const news=(id:string,occurredAt=recent):NewsBriefV1=>({
 contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",id,
 headline:"Federal Reserve assesses inflation and economic growth",
 summary:"Official update provides new context for interest rates and equity valuations.",
 sourceName:"Federal Reserve",sourceUrl:"https://www.federalreserve.gov/newsevents/pressreleases/"+id+".htm",
 sourceKind:"official",occurredAt,observedAt:occurredAt,verification:"SOURCE_VERIFIED",
});
const market=(symbol:string,change:number,asOf="2026-11-23"):PublicMarketObservation=>({
 id:symbol,label:symbol,symbol,type:"AI / Semis",frequency:"daily",last:100,
 change,change3d:null,change5d:null,changeUnit:"%",asOf,sourceName:"Source",
 sourceUrl:"https://www.nasdaq.com/market-activity/etf/"+symbol.toLowerCase()+"/historical",
});
const pair:MarketDivergenceRead={
 id:"semis-vs-nasdaq",title:"Semiconductors vs Nasdaq 100",left:"SMH",right:"QQQ",
 question:"Are chips leading?",nextTest:"Check earnings, breadth.",
 status:"OPPOSITE_MOVE",leftChange:6,rightChange:-1,gapPp:7,sourceSession:"2026-11-23",
 leftSourceUrl:"https://www.nasdaq.com/market-activity/etf/smh/historical",
 rightSourceUrl:"https://www.nasdaq.com/market-activity/etf/qqq/historical",reason:null,
};
test("radar features verified last-24h news, large daily moves and matched divergences",()=>{
 const r=projectHomeRadar({now,news:[news("one"),news("old","2026-11-22T13:00:00Z")],
  market:[market("NVDA",9),market("QQQ",1)],divergences:[pair]});
 assert.equal(r.newsCount,1);
 assert.equal(r.moveCount,1);
 assert.equal(r.divergenceCount,1);
 assert.deepEqual(new Set(r.items.map(x=>x.kind)),new Set(["NEWS","BIG_MOVE","DIVERGENCE"]));
 assert.ok(r.items.every(x=>x.href.startsWith("/")));
 assert.ok(r.items.some(x=>x.href.endsWith("#divergence-watch")));
});
test("future/stale news, stale moves and unmatched comparisons never become fresh",()=>{
 const r=projectHomeRadar({now,
  news:[news("future","2026-11-24T01:00:00Z"),news("old","2026-11-22T20:00:00Z")],
  market:[market("NVDA",25,"2026-11-18"),market("AAPL",5)],
  divergences:[{...pair,status:"NOT_COMPARABLE",sourceSession:null,leftChange:null,rightChange:null,gapPp:null}]});
 assert.equal(r.newsCount,0);assert.equal(r.divergenceCount,0);
 assert.deepEqual(r.items.map(x=>x.id),["move:AAPL"]);
});
test("creator material is not exposed without an authenticated reviewed digest",()=>{
 const d={version:"creator-signals-v1" as const,generatedAt:"2026-11-23T23:00:00Z",
  marketSession:"2026-11-23",coverage:"reviewed",
  overview:{headline:"Rebound",news:[],divergences:[],signals:[]},
  creators:[{publisher:"Traders Reality",videoId:"abcdefghijk",title:"Rebound",
   publishedAt:"2026-11-23T12:00:00Z",sourceStatus:"reviewed" as const,
   news:[],fundamentals:[],opinions:[],changed:"new",
   views:[{asset:"QQQ",bias:"Bullish" as const,horizon:"days to weeks",
    signals:["Potential relief rally"],sources:["abcdefghijk"]}]}]};
 const publicRead=projectHomeRadar({now,news:[],market:[],divergences:[],
  creatorDigest:d,creatorIsAuthorised:false});
 assert.equal(publicRead.creatorCount,0);
 assert.equal(publicRead.creatorAccess,"PRIVATE_LOCKED");
 const owner=projectHomeRadar({now,news:[],market:[],divergences:[],
  creatorDigest:d,creatorIsAuthorised:true});
 assert.equal(owner.creatorCount,1);
 assert.equal(owner.items[0].statusLabel,"ATTRIBUTED · REVIEWED");
});
test("theme-aware glowing full-circle radar preserves its original shortcut links",()=>{
 const css=readFileSync("app/blue-desk/market-first-home.module.css","utf8");
 const page=readFileSync("app/blue-desk/page.tsx","utf8");
 const tokens=readFileSync("app/bluebelly-tokens.css","utf8");
 assert.match(css,/\.orbit:hover,\.orbit:focus-within/);
 assert.match(css,/0 0 0 2px var\(--bb-command-accent\)/);
 assert.match(css,/\.orbitCore\{[^}]*position:absolute;inset:0/);
 assert.match(css,/\.orbitCore\{[^}]*cursor:pointer/);
 assert.match(tokens,/data-bluebelly-theme="yellow-black"[\s\S]*?--bb-command-accent:#ffe500/);
 assert.match(page,/<RadarIntelligenceTrigger className=\{marketHome\.orbitCore\}>/);
 for(const label of ["MARKETS","CATALYSTS","NEWSROOM"])
  assert.ok(page.includes(">"+label+"</Link>"));
 const ui=readFileSync("components/blue-desk/HomeRadarIntelligence.tsx","utf8");
 assert.match(ui,/aria-expanded=\{open\}/);
 assert.match(ui,/data-home-radar-intelligence="source-dated-v1"/);
});
