import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {editorialPriceCard,editorialPriceLines,projectEditorialPriceCards}
  from "../lib/editorial-price-context.ts";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";
import type {MarketMonitorRow} from "../lib/market-monitor.ts";

function row(patch:Partial<MarketMonitorRow>={}):MarketMonitorRow {
  const t=(date:string)=>Date.parse(date+"T12:00:00Z")/1000;
  return {
    id:"brent",symbol:"BZ=F",label:"Brent Futures",type:"Energy",benchmark:null,
    last:112,previousClose:110,sessionOpen:null,dayChange:null,gapChange:null,
    change3d:null,change5d:null,rsi:null,stochRsi:null,volPercentile:null,
    relative5d:null,attentionScore:0,hot:false,contradiction:false,tags:[],
    asOf:"2026-10-23",frequency:"daily",sourceName:"Single source",
    sourceUrl:"https://example.com/price-history",
    points:[
      {time:t("2026-10-15"),close:100},
      {time:t("2026-10-16"),close:104},
      {time:t("2026-10-19"),close:106},
      {time:t("2026-10-20"),close:105},
      {time:t("2026-10-21"),close:109},
      {time:t("2026-10-22"),close:112},
      {time:t("2026-10-23"),close:999}, // incomplete as of this UTC day — must be omitted
    ],
    ...patch,
  };
}
test("daily 1/3/5 completed-date comparisons exclude same UTC day and preserve actual reference date",()=>{
  const p=editorialPriceCard(row(),"2026-10-23T04:00:00Z");
  assert.equal(p.lastDate,"2026-10-22");
  assert.equal(p.lastClose,112);
  assert.deepEqual(p.comparisons.map(x=>x.referenceDate),["2026-10-21","2026-10-19","2026-10-15"]);
  assert.deepEqual(p.comparisons.map(x=>x.change),[3,6,12]);
  assert.equal(p.comparisons[0].percent,2.75);
  assert.match(editorialPriceLines(p),/3 sessions/);
});
test("missing comparisons remain explicitly unknown, never zero or synthetic",()=>{
  const p=editorialPriceCard(row({points:[{time:Date.parse("2026-10-22")/1000,close:90}]}),"2026-10-23T04:00:00Z");
  assert.equal(p.lastClose,90);
  for(const w of p.comparisons) {
    assert.equal(w.change,null);
    assert.equal(w.referenceDate,null);
    assert.match(w.reason||"",/Fewer than/);
  }
});
test("nominal yields use absolute basis points, never percent return",()=>{
  const p=editorialPriceCard(row({type:"Rates",points:[
    {time:Date.parse("2026-10-21")/1000,close:4.90},
    {time:Date.parse("2026-10-22")/1000,close:5.04},
  ]}),"2026-10-23T04:00:00Z");
  assert.equal(p.comparisons[0].change,14);
  assert.equal(p.comparisons[0].unit,"bp");
  assert.equal(p.comparisons[0].percent,null);
});
test("monthly levels, stale bars, invalid source URLs fail closed",()=>{
  const m=editorialPriceCard(row({frequency:"monthly"}),"2026-10-23T04:00:00Z");
  assert.equal(m.lastClose,null);
  const old=editorialPriceCard(row({sourceUrl:"javascript:alert(1)",points:[
    {time:Date.parse("2026-10-02")/1000,close:100}
  ]}),"2026-10-23T04:00:00Z");
  assert.equal(old.status,"STALE");assert.equal(old.sourceUrl,null);
});
test("scoped source projection excludes undisclosed watchlist assets",()=>{
  const cards=projectEditorialPriceCards([row(),row({id:"hidden-private-asset"})],"2026-10-23T04:00:00Z");
  assert.deepEqual(cards.map(x=>x.id),["brent"]);
});
test("owner Editorial and Presenter are exact session-protected Bluebelly routes, not public readers",()=>{
  for(const path of ["/owner/editorial","/owner/presenter"]){
    assert.equal(blueDeskHostAccess(path,"bluebelly-desk.vercel.app"),"private");
    assert.equal(blueDeskHostAccess(path,"alchemy-live-market-desk.vercel.app"),"private");
  }
  const header=readFileSync(new URL("../components/blue-desk/BlueDeskHeader.tsx",import.meta.url),"utf8");
  assert.doesNotMatch(header,/\["Writing Desk", "\/owner\/editorial"\]/);
  assert.match(header,/\["My Desk", "\/my-reports"\]/);
  assert.match(header,/\["Presenter Prep", "\/owner\/presenter"\]/);
  assert.equal(blueDeskHostAccess("/owner/presenter","bluebelly-desk.vercel.app"),"private");
  assert.match(header,/ownerWorkspace/);
  assert.doesNotMatch(header.split("const PRIVATE_NAV = [")[1]?.split("] as const;")[0]||"",/\/hybrid-output\/prepare/);
  const presenter=readFileSync(new URL("../app/owner/presenter/page.tsx",import.meta.url),"utf8");
  assert.match(presenter,/PresenterTechnicalChecks/);
  assert.match(presenter,/my-reports/);
});
