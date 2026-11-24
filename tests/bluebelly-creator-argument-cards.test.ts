import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {buildCreatorArgumentGroups} from "../lib/bluebelly-creator-argument-cards.ts";
import type {CreatorDigest,CreatorTake} from "../lib/bluebelly-creator-signals.ts";
const take=(publisher:string,videoId:string,opinion:string):CreatorTake=>({publisher,videoId,title:"Video title",publishedAt:"2026-11-23",sourceStatus:"reviewed",news:["Oil prices fell."],views:[],fundamentals:["Capex still exceeds cash flow."],opinions:[opinion],changed:"No prior comparison available."});
test("argument groups lead with exact claims, keep distinct opinions and attach sources after the claim",()=>{
 const digest:CreatorDigest={version:"creator-signals-v1",generatedAt:"2026-11-24T08:00:00Z",marketSession:"2026-11-23",coverage:"Partial",overview:{headline:"Different scenarios",news:["Oil prices fell."],divergences:["Equal weight trails technology."],signals:[]},creators:[take("One","abcdefghijk","The rally could continue."),take("Two","lmnopqrstuv","The rally could fail.")]};
 const groups=buildCreatorArgumentGroups(digest);
 const news=groups.find(g=>g.id==="news")!;
 assert.equal(news.cards.length,1);assert.equal(news.cards[0].text,"Oil prices fell.");assert.equal(news.cards[0].sources.length,2);
 assert.deepEqual(groups.find(g=>g.id==="opinions")!.cards.map(c=>c.text),["The rally could continue.","The rally could fail."]);
 assert.equal(groups.find(g=>g.id==="divergences")!.cards[0].sources.length,0);
 assert.equal(groups.find(g=>g.id==="fundamentals")!.cards[0].sources.length,2);
});
test("presentation uses standalone bounded cards, collapsible source details, visible list dividers and mobile stacking",()=>{
 const panel=readFileSync("components/blue-desk/CreatorIntelligencePanel.tsx","utf8");
 const css=readFileSync("components/blue-desk/creator-intelligence.module.css","utf8");
 assert.match(panel,/data-creator-layout="argument-first"/);
 assert.match(panel,/buildCreatorArgumentGroups\(digest\)/);
 assert.match(panel,/group.cards.slice\(0,4\)/);
 assert.match(panel,/row.signals.slice\(0,3\)/);
 assert.match(panel,/Original video notes and full asset views/);
 assert.doesNotMatch(panel,/Individual takes|Expand a creator to review|Counterview|Who supplied/i);
 assert.match(css,/\.argumentGrid,\.assetGrid\{[^}]*align-items:start/);
 assert.match(css,/\.bullets li\+li\{margin-top:0;border-top:1px/);
 assert.match(css,/\.argumentGrid,\.assetGrid\{grid-template-columns:1fr\}/);
 assert.ok(panel.indexOf('read.status==="unauthorised"')<panel.indexOf('recentReviewed=await getPrivateReviewedCreatorArguments'));
});
