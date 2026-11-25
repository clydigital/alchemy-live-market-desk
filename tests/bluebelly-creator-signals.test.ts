import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {parseCreatorDigest,parseCreatorDigestHtml,orderCreatorSignals,creatorMarketMatch,creatorSignalGroup,type CreatorDigest} from "../lib/bluebelly-creator-signals.ts";
import type {PublicMarketObservation} from "../lib/blue-desk-public-markets.ts";

const now=new Date("2026-11-19T10:30:00Z");
const row=(asset:string)=>({asset,bias:"Neutral" as const,horizon:"daily",signals:["Potential higher low", "Watch 100 reclaim"],sources:["abcdefghijk"]});
const sample=():CreatorDigest=>({version:"creator-signals-v1",generatedAt:"2026-11-19T09:40:00Z",marketSession:"2026-11-18",coverage:"partial",overview:{headline:"Review",news:["Main event"],signals:[row("SPY")],divergences:[]},creators:[{publisher:"Creator",videoId:"abcdefghijk",title:"Review",publishedAt:"2026-11-18T00:00:00Z",sourceStatus:"reviewed",news:[],views:[row("SPY")],fundamentals:[],opinions:[],changed:"Prior review unavailable"}]});
test("preserves exact levels and multiline structural bullets, omits unknown overview attribution",()=>{
 const d=sample();assert.deepEqual(parseCreatorDigest(d,now)?.overview.signals[0].signals,row("SPY").signals);
 d.overview.signals[0].sources=["unknown"];const partial=parseCreatorDigest(d,now);assert.equal(partial?.overview.signals.length,0);assert.equal(partial?.creators.length,1);assert.match(partial?.coverage??"",/omitted 1/);
});
test("rejects future timestamps or missing reviewed video identifiers",()=>{
 const a=sample();a.generatedAt="2026-11-20T00:00:00Z";assert.equal(parseCreatorDigest(a,now),null);
 const b=sample();b.creators[0].videoId="";assert.equal(parseCreatorDigest(b,now),null);
 const c=sample();c.creators[0].sourceStatus="supplied";Object.assign(c.creators[0],{videoId:null,publishedAt:null});c.overview.signals[0].sources=["Creator (supplied)"];assert.equal(parseCreatorDigest(c,now)?.creators[0].publishedAt,null);
});
test("indices first, then XL sectors, then technology, then other instruments",()=>{
 assert.deepEqual(orderCreatorSignals(["XAUUSD","AMD","XLK","SPY","QQQ","XLE"].map(row)).map(r=>r.asset),["SPY","QQQ","XLK","XLE","AMD","XAUUSD"]);
 assert.deepEqual(["SPY","XLK","AMD","XAUUSD"].map(creatorSignalGroup),["Indices & broad market","XL sector ETFs","Technology & semiconductors","Other assets"]);
});
const market=(symbol:string,asOf="2026-11-18"):PublicMarketObservation=>({id:symbol,label:symbol,symbol,type:"Major Index",frequency:"daily",asOf,last:100,change:1,change3d:2,change5d:3,changeUnit:"%",sourceName:"Test",sourceUrl:null});
test("never substitute ETF proxy or future/uncompleted price for cash index",()=>{
 assert.equal(creatorMarketMatch("SPX",[market("SPY")],now),null);
 assert.equal(creatorMarketMatch("SPX",[market("SP500")],now)?.symbol,"SP500");
 assert.equal(creatorMarketMatch("SPY",[market("SPY","2026-11-19")],now),null);
 assert.equal(creatorMarketMatch("SPY",[market("SPY","2026-11-17")],now)?.latestSession,false);
});
test("private digest reader and fallback are guarded; homepage response is private/no-store",()=>{
 const reader=readFileSync(new URL("../lib/bluebelly-creator-signals-server.ts",import.meta.url),"utf8");
 assert.ok(reader.indexOf("if(!ownerId)")<reader.indexOf('from("blue_desk_work_html_editions")'));
 assert.match(reader,/\.eq\("owner_user_id",ownerId\)/);
 assert.match(reader,/app_access_allowlist/);assert.match(reader,/cache:"no-store"/);
 const panel=readFileSync(new URL("../components/blue-desk/CreatorIntelligencePanel.tsx",import.meta.url),"utf8");
 assert.ok(panel.indexOf('read.status==="unauthorised"')<panel.indexOf('await getPrivateReviewedCreatorArguments'));
 const middleware=readFileSync(new URL("../middleware.ts",import.meta.url),"utf8");assert.match(middleware,/target==="\/blue-desk".*"private, no-store"/);
});
test("immutable Work HTML envelope safely round-trips literal markup",()=>{
 const value=sample();value.overview.headline="Watch <100 & >90";
 const html='<html><pre id="creator-signals-v1">'+JSON.stringify(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')+'</pre></html>';
 assert.equal(parseCreatorDigestHtml(html,now)?.overview.headline,value.overview.headline);
 assert.equal(parseCreatorDigestHtml('<pre id="creator-signals-v1"><b>invalid</b></pre>',now),null);
});


test("latest mixed digest accepts handoff-reviewed exact video IDs without invented original dates",()=>{
 const d=sample();
 d.creators.push({
  publisher:"TraderNick",videoId:"N5Ee5JLBBls",title:"Market Crash, 2026",
  publishedAt:null,sourceStatus:"handoff_reviewed",news:[],views:[row("QQQ")],
  fundamentals:[],opinions:[],changed:"Authentic handoff; exact publish time not verified"
 });
 d.generatedAt="2026-11-19T10:00:00Z";
 const parsed=parseCreatorDigest(d,now);
 assert.equal(parsed?.creators.length,2);
 assert.equal(parsed?.creators[1].sourceStatus,"handoff_reviewed");
 assert.equal(parsed?.creators[1].publishedAt,null);
 // Production-reviewed original videos still MUST carry exact publication time.
 d.creators[1].sourceStatus="reviewed";
 assert.equal(parseCreatorDigest(d,now),null);
 d.creators[1].sourceStatus="handoff_reviewed";
 d.creators[1].videoId="not-a-valid-video-id";
 assert.equal(parseCreatorDigest(d,now),null);
});

test("private digest with a handoff and supplied video preserves unknown dates and source-key linkage",()=>{
 const d=sample();
 d.creators.push({
  publisher:"Truthbombs",videoId:"RifmW9r45mQ",title:"AI trade",
  publishedAt:null,sourceStatus:"handoff_reviewed",news:[],views:[row("SMH")],
  fundamentals:[],opinions:[],changed:"Pending original metadata"
 });
 d.creators.push({
  publisher:"Trade Brigade",videoId:null,title:"User-supplied research",
  publishedAt:null,sourceStatus:"supplied",news:[],views:[],
  fundamentals:[],opinions:[],changed:"Original not confirmed"
 });
 d.overview.signals.push({...row("SMH"),sources:["RifmW9r45mQ"]});
 const received=parseCreatorDigest(d,now);
 assert.equal(received?.creators.length,3);
 assert.equal(received?.overview.signals.at(-1)?.sources[0],"RifmW9r45mQ");
 d.overview.signals[1].sources=["unknown-video"];
 assert.equal(parseCreatorDigest(d,now)?.overview.signals.length,1);
 assert.equal(parseCreatorDigest(d,now)?.creators.length,3);
});

test("latest read-only creator panel shows unmatched reviewed receipts and session lag separately",()=>{
 const panel=readFileSync(new URL("../components/blue-desk/CreatorIntelligencePanel.tsx",import.meta.url),"utf8");
 assert.match(panel,/data-creator-uncompiled="source-reviewed"/);
 assert.match(panel,/older than latest completed tape/);
 assert.match(panel,/digestVideoIds/);
 const gate=panel.indexOf('read.status==="unauthorised"');
 const intake=panel.indexOf('recentReviewed=await getPrivateReviewedCreatorArguments(now)');
 assert.ok(gate>=0&&intake>gate,"private ingestion must only happen after owner gate");
});


test("long thematic asset labels from the 25 November digest are valid",()=>{
 const d=sample();const long="AI compute / electrical and cooling suppliers";
 d.overview.signals.push(row(long));d.creators[0].views.push(row(long));
 const result=parseCreatorDigest(d,now);
 assert.equal(result?.overview.signals[1].asset,long);
 assert.equal(result?.creators[0].views[1].asset,long);
 assert.equal(result?.coverage,"partial");
});
test("one malformed asset signal cannot erase a fresh owner digest or other creator views",()=>{
 const d=sample();d.overview.signals.push({...row("bad"),asset:"x".repeat(121)});
 d.creators[0].views.push({...row("bad"),signals:[]});
 const result=parseCreatorDigest(d,now);
 assert.equal(result?.overview.signals.length,1);
 assert.equal(result?.creators[0].views.length,1);
 assert.equal(result?.generatedAt,d.generatedAt);
 assert.match(result?.coverage??"",/omitted 2/);
});
