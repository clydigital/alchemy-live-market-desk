import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decisionTopics,decisionCalendar,compareRelease,calendarOutcome,paginateDecisionTopics,decisionSourceFreshness} from '../lib/bluebelly-decision-brief.ts';
import {buildPresenterCalendar} from '../lib/presenter-calendar.ts';
import {storyMarketTransmission} from '../lib/blue-desk-thesis-ledger.ts';
import type {NewsBriefV1} from '../lib/market-brief-news.ts';
const now=new Date('2026-11-10T12:00:00Z');
const calendar=buildPresenterCalendar([],{events:[],coverage:'unavailable',warning:'test'},now);
const news=(headline:string,id:string)=>({id,headline,summary:headline,occurredAt:now.toISOString(),sourceName:'Issuer',sourceUrl:'https://example.com/'+id} as NewsBriefV1);
test('one topic stays one; five independent topics stay five without filler',()=>{
 assert.equal(decisionTopics([news('NVIDIA AI chips','1')],calendar,now).length,1);
 const rows=['Oil supply','Treasury yields','NVIDIA chips','Company earnings','Yen currency'].map((h,i)=>news(h,String(i)));
 assert.equal(decisionTopics(rows,calendar,now).length,5);
 assert.equal(decisionTopics([],calendar,now).length,0);
 assert.equal(decisionTopics([{...rows[0],occurredAt:'2026-11-11T00:00:00Z'}],calendar,now).length,0);
});
test('same basis comparisons and missing or mismatched evidence',()=>{
 const base={value:2,metric:'EPS',period:'2026Q3',basis:'GAAP',unit:'USD/share',releaseId:'issuer-q3',sourceUrl:'https://example.com',asOf:'2026-10-27T12:00:00Z',verified:true};
 const actual={...base,value:3,asOf:'2026-10-28T11:00:00Z'};
 assert.deepEqual(compareRelease(actual,base),{status:'BEAT',surprise:1});
 assert.equal(compareRelease({...actual,value:1},base).status,'MISS');
 assert.equal(compareRelease({...actual,value:2},base).status,'INLINE');
 for(const bad of [null,{...base,basis:'adjusted'},{...base,period:'2026Q2'},{...base,unit:'EUR'},{...base,verified:false},{...base,asOf:actual.asOf}]) assert.equal(compareRelease(actual,bad).status,'COMPARISON UNAVAILABLE');
});
test('future FOMC remains scheduled; no result inferred from elapsed clock',()=>{
 const e={id:'fed',kind:'economic',title:'FOMC',status:'scheduled',localDate:'2026-10-28',scheduledAt:'2026-10-28T18:00:00Z',verificationState:'official',actual:null,consensus:null,decidingQuestion:'Next policy path?',sourceUrl:'https://federalreserve.gov',sourceName:'Fed',affectedAssets:['US02Y']} as const;
 const c={...calendar,events:[e as any]};
 const now=new Date('2026-10-28T12:00:00Z');
 assert.equal(decisionCalendar(c,now).policy.length,1);
 assert.equal(decisionCalendar(c,new Date('2026-10-28T19:00:00Z')).released.length,0);
 assert.equal(calendarOutcome(e as any),'Verified actual unavailable');
});
test('backwardation never receives an AI explanation from the substring in sustains',()=>{
 const explanation=storyMarketTransmission({slug:'front-month-backwardation-sustains-positive-roll-returns',title:'Front-month backwardation sustains positive roll returns'});
 assert.doesNotMatch(explanation,/AI orders/);
 assert.match(explanation,/fuel|energy/);
 assert.doesNotMatch(storyMarketTransmission({slug:'uncertain-chain',title:'Uncertain chain remains'}),/AI orders/);
});

test('decision-first layout keeps market verdict compact and evidence limits expandable',()=>{
 const ui=readFileSync(new URL('../components/blue-desk/DecisionBrief.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../components/blue-desk/DecisionBrief.module.css',import.meta.url),'utf8');
 assert.match(ui,/className=\{s\.headlineRow\}/);
 assert.match(ui,/className=\{s\.verdict\}/);
 assert.match(ui,/className=\{s\.next\}/);
 assert.match(ui,/<details className=\{s\.evidence\}>/);
 assert.match(ui,/The outcome is pending/);
 assert.ok(ui.indexOf('<details className={s.evidence}>')<ui.indexOf('<div className={s.topics}>'));
 assert.match(css,/\.headlineRow\{display:flex/);
 assert.match(css,/@media\(max-width:700px\)/);
});

test('six cards per page, no padding, no repeated stories and bounded page navigation',()=>{
 const items=Array.from({length:13},(_,i)=>'story-'+(i+1));
 assert.deepEqual(paginateDecisionTopics(items,1).items,items.slice(0,6));
 assert.deepEqual(paginateDecisionTopics(items,2).items,items.slice(6,12));
 assert.deepEqual(paginateDecisionTopics(items,3).items,items.slice(12));
 assert.equal(paginateDecisionTopics(items,2).totalPages,3);
 assert.equal(paginateDecisionTopics(items,0).page,1);
 assert.equal(paginateDecisionTopics(items,99).page,3);
 assert.equal(paginateDecisionTopics(items,Number.NaN).page,1);
 assert.deepEqual(paginateDecisionTopics([],2),{items:[],page:1,totalPages:1,total:0,pageSize:6});
 assert.deepEqual(paginateDecisionTopics(items.slice(0,5)).items,items.slice(0,5));
});
test('source-age labels distinguish the observed event date, historical copy and pending events',()=>{
 const asOf=new Date('2026-11-02T00:00:00Z');
 assert.equal(decisionSourceFreshness('2026-11-01T12:00:00Z','NEW',asOf),'SOURCE DATED WITHIN 48H');
 assert.equal(decisionSourceFreshness('2026-10-29T12:00:00Z','FEATURE',asOf),'DATED THIS WEEK');
 assert.equal(decisionSourceFreshness('2026-10-18','FEATURE',asOf),'OLDER EDITORIAL / ARCHIVE');
 assert.equal(decisionSourceFreshness('2026-11-03T12:00:00Z','UPCOMING',asOf),'SCHEDULED · OUTCOME PENDING');
 assert.equal(decisionSourceFreshness('2026-11-03T12:00:00Z','NEW',asOf),'SOURCE DATE NEEDS REVIEW');
 assert.equal(decisionSourceFreshness('not-a-date','NEW',asOf),'SOURCE DATE NEEDS REVIEW');
});
test('both public views honour six-story pagination while preserving evidence boundaries',()=>{
 const home=readFileSync(new URL('../app/blue-desk/page.tsx',import.meta.url),'utf8');
 const daily=readFileSync(new URL('../app/blue-desk/daily-report/page.tsx',import.meta.url),'utf8');
 const cards=readFileSync(new URL('../components/blue-desk/DecisionBrief.tsx',import.meta.url),'utf8');
 for(const page of [home,daily]){
   assert.match(page,/storiesPage/);
   assert.match(page,/storyPage=\{storyPage\}/);
 }
 assert.match(cards,/paginateDecisionTopics\(topics,storyPage,6\)/);
 assert.match(cards,/aria-current=\{page===storyPages.page/);
 assert.match(cards,/decisionSourceFreshness/);
 assert.match(cards,/Reader time is not ingestion proof/);
 assert.match(cards,/visibleTopics\.map/);
});
