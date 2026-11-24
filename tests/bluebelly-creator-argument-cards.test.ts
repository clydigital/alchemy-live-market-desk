import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {groupCreatorTakes,uniqueResearchPoints} from "../lib/bluebelly-creator-argument-cards.ts";
import type {CreatorTake} from "../lib/bluebelly-creator-signals.ts";
const take=(publisher:string,videoId:string,opinion:string):CreatorTake=>({publisher,videoId,title:"Video title",publishedAt:"2026-11-23",sourceStatus:"reviewed",news:["Oil prices fell."],views:[],fundamentals:["Capex still exceeds cash flow."],opinions:[opinion],changed:"No prior comparison available."});
test("publisher boundaries retain different video takes and conflicting arguments",()=>{
 const takes=[take("One","abcdefghijk","The rally could continue."),take("Two","lmnopqrstuv","The rally could fail."),take("One","12345678901","Watch for a reversal.")];
 const groups=groupCreatorTakes(takes);
 assert.deepEqual(groups.map(g=>g.publisher),["One","Two"]);
 assert.deepEqual(groups[0].takes,[takes[0],takes[2]]);
 assert.deepEqual(groups[1].takes,[takes[1]]);
 assert.deepEqual(uniqueResearchPoints(["Oil prices fell.","  oil prices fell. ","The rally could continue.","The rally could fail."]),["Oil prices fell.","The rally could continue.","The rally could fail."]);
});
test("presentation separates overview and publishers without forcing thematic cards or long equal-height columns",()=>{
 const panel=readFileSync("components/blue-desk/CreatorIntelligencePanel.tsx","utf8");
 const css=readFileSync("components/blue-desk/creator-intelligence.module.css","utf8");
 assert.match(panel,/data-creator-layout="overview-and-creators"/);
 assert.match(panel,/data-creator-editorial="separate-publishers"/);
 assert.match(panel,/groupCreatorTakes\(takes\)/);
 assert.match(panel,/points.slice\(0,limit\)/);
 assert.match(panel,/Consolidated asset views/);
 assert.doesNotMatch(panel,/buildCreatorArgumentGroups|ArgumentGroupCards|Counterview|Who supplied/i);
 assert.match(css,/\.creatorStack\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/\.bullets li\+li\{margin-top:0;border-top:1px/);
 assert.ok(panel.indexOf('read.status==="unauthorised"')<panel.indexOf('recentReviewed=await getPrivateReviewedCreatorArguments'));
});
