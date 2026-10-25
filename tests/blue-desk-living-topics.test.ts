import test from "node:test";
import assert from "node:assert/strict";
import { projectLivingMarketTopics } from "../lib/blue-desk-living-topics.ts";
import type { NewsBriefV1 } from "../lib/market-brief-news.ts";

function fact(id:string,headline:string,summary:string,when="2026-10-25T04:00:00Z"):NewsBriefV1{
 return {contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",id,headline,summary,
  sourceName:"Original report",sourceUrl:"https://example.org/reports/"+id,
  sourceKind:"primary",occurredAt:when,observedAt:when,verification:"SOURCE_VERIFIED"};
}

test("rolling topics use only dated verified news supplied by the upstream reader",()=>{
 const rows=[
  fact("brent","Oil tanker transit data published","The port authority released a dated oil transit report."),
  fact("fed","US Treasury auction results released","Treasury published bid and cover results for an auction.",
    "2026-10-25T02:00:00Z"),
  fact("nvda","Semiconductor chip capex results","An issuer published the expenditure numbers in its financial statements.",
    "2026-10-25T01:00:00Z"),
 ];
 const groups=projectLivingMarketTopics(rows);
 assert.deepEqual(groups.map(g=>g.id),["oil-gulf-energy","rates-bonds-credit","ai-technology"]);
 assert.equal(groups.reduce((sum,g)=>sum+g.updates.length,0),3);
 assert.equal(groups[0].updates[0].sourceUrl,rows[0].sourceUrl);
 assert.equal(groups[0].latestObservedAt,rows[0].occurredAt);
 assert.ok(groups.every(g=>g.guidingQuestion.endsWith("?")));
});

test("topic routing does not inflate counts, invent price reactions, or attach an old canonical Story",()=>{
 const row=fact("jpy","The yen moves","The original report describes currency policy developments.");
 const repeat={...row};
 const groups=projectLivingMarketTopics([row,repeat]);
 assert.equal(groups.length,1);
 assert.equal(groups[0].updates.length,1);
 assert.equal(groups[0].updates[0].summary,row.summary);
 assert.equal(groups[0].updates[0].verification,"SOURCE_VERIFIED");
 assert.equal("thesisVersionId" in groups[0],false);
 assert.equal("marketReaction" in groups[0],false);
 assert.equal(projectLivingMarketTopics([row],0).length,0);
});

test("unknown headlines remain clearly labelled as other developments",()=>{
 const groups=projectLivingMarketTopics([
  fact("a","A regulator published a notice","An original notice was posted by the regulator."),
 ]);
 assert.equal(groups[0].id,"other-catalysts");
 assert.match(groups[0].guidingQuestion,/what evidence is still missing/i);
});
