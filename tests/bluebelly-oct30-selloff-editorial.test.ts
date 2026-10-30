import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {OCT30_SELL_OFF,oct30SelloffIsLead} from "../lib/bluebelly-oct30-tech-selloff.ts";
import {decisionTopics} from "../lib/bluebelly-decision-brief.ts";
import {buildPresenterCalendar} from "../lib/presenter-calendar.ts";

const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const windowTime=new Date("2026-10-30T19:35:00Z");
const calendar=buildPresenterCalendar([],{events:[],coverage:"unavailable",warning:"test"},windowTime);

test("time-bounded intraday edition leads but never masquerades as a close",()=>{
 assert.ok(oct30SelloffIsLead(windowTime));
 assert.ok(!oct30SelloffIsLead(new Date("2026-10-29T15:00:00Z")));
 assert.ok(!oct30SelloffIsLead(new Date("2026-11-09T00:00:00Z")));
 assert.match(OCT30_SELL_OFF.fact,/2:15 p\.m\./);
 assert.match(OCT30_SELL_OFF.fact,/not closing returns/);
 assert.equal(decisionTopics([],calendar,windowTime)[0].id,OCT30_SELL_OFF.id);
 const later=new Date("2026-11-10T12:00:00Z");
 const laterCalendar=buildPresenterCalendar([],{events:[],coverage:"unavailable",warning:"test"},later);
 assert.ok(!decisionTopics([],laterCalendar,later).some(x=>x.id===OCT30_SELL_OFF.id));
});

test("new source-dated market story is directly readable from homepage, Newsroom and Daily Report",()=>{
 const landing=read("components/blue-desk/DecisionBrief.tsx");
 const stories=read("app/blue-desk/key-stories/page.tsx");
 const newsroom=read("app/blue-desk/newsroom/page.tsx");
 const daily=read("app/blue-desk/daily-report/page.tsx");
 const crash=read("app/blue-desk/crash-opportunity/page.tsx");
 const article=read("components/blue-desk/Oct30TechSelloffFeature.tsx");
 assert.match(stories,/feature==="ai-cash-selloff-october-2026"/);
 assert.match(landing,/Market mechanism, not a verified price reaction/);
 assert.match(newsroom,/data-newsroom-lead="oct30-ai-selloff"/);
 assert.match(newsroom,/editorials\.unshift/);
 assert.ok(newsroom.indexOf("data-newsroom-lead")<newsroom.indexOf("<BluebellyNewsWire"),"Lead precedes the ordinary wire");
 assert.match(daily,/data-daily-lead="oct30-ai-selloff"/);
 assert.match(crash,/data-oct30-newsroom-context/);
 for(const name of ["Amazon","Intel","Alphabet","Reddit","Credit"]){
  assert.match(article,new RegExp(name,"i"),name);
 }
 assert.match(article,/credit-spread|credit spread/i);
 assert.match(article,/14:15 EDT/);
 assert.match(article,/not the final closing session/);
});

test("the narrative cites actual issuers and describes the crash as unconfirmed",()=>{
 const article=read("components/blue-desk/Oct30TechSelloffFeature.tsx");
 assert.match(article,/ir\.aboutamazon\.com/);
 assert.match(article,/www\.intc\.com/);
 assert.match(article,/investor\.redditinc\.com/);
 assert.match(article,/alfred\.stlouisfed\.org/);
 assert.match(article,/systemic crash remains unconfirmed/);
});
