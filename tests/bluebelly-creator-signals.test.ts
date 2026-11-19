import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {parseCreatorDigest,parseCreatorDigestHtml,orderCreatorSignals,creatorMarketMatch} from "../lib/bluebelly-creator-signals.ts";
import type {PublicMarketObservation} from "../lib/blue-desk-public-markets.ts";

const now=new Date("2026-11-19T10:30:00Z");
const row=(asset:string)=>({asset,bias:"Neutral" as const,horizon:"daily",signals:["Potential higher low", "Watch 100 reclaim"],sources:["abcdefghijk"]});
const sample=()=>({version:"creator-signals-v1",generatedAt:"2026-11-19T09:40:00Z",marketSession:"2026-11-18",coverage:"partial",overview:{headline:"Review",news:["Main event"],signals:[row("SPY")],divergences:[]},creators:[{publisher:"Creator",videoId:"abcdefghijk",title:"Review",publishedAt:"2026-11-18T00:00:00Z",sourceStatus:"reviewed",news:[],views:[row("SPY")],fundamentals:[],opinions:[],changed:"Prior review unavailable"}]});
test("preserves exact levels and multiline structural bullets, rejects unknown overview attribution",()=>{
 const d=sample();assert.deepEqual(parseCreatorDigest(d,now)?.overview.signals[0].signals,row("SPY").signals);
 d.overview.signals[0].sources=["unknown"];assert.equal(parseCreatorDigest(d,now),null);
});
test("rejects future timestamps or missing reviewed video identifiers",()=>{
 const a=sample();a.generatedAt="2026-11-20T00:00:00Z";assert.equal(parseCreatorDigest(a,now),null);
 const b=sample();b.creators[0].videoId="";assert.equal(parseCreatorDigest(b,now),null);
 const c=sample();c.creators[0].sourceStatus="supplied";Object.assign(c.creators[0],{videoId:null,publishedAt:null});c.overview.signals[0].sources=["Creator (supplied)"];assert.equal(parseCreatorDigest(c,now)?.creators[0].publishedAt,null);
});
test("indices first, then XL sectors, then technology, then other instruments",()=>{
 assert.deepEqual(orderCreatorSignals(["XAUUSD","AMD","XLK","SPY","QQQ","XLE"].map(row)).map(r=>r.asset),["SPY","QQQ","XLK","XLE","AMD","XAUUSD"]);
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
