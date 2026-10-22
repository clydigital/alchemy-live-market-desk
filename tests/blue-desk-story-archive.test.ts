import assert from "node:assert/strict";
import test from "node:test";
import { exactPublishedStoryId,newestStoryReadings,readingsForStory,paginateStoryReadings,type PublishedStoryReading } from "../lib/blue-desk/story-archive.ts";
import { storyMatchesSubject } from "../lib/blue-desk/story-identity.ts";
import type {EditorialArticle} from "../lib/market-brief-editorial.ts";

const a="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222";
const e1="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",e2="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",e3="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
function reading(story:string,edition:string,date:string,title:string):PublishedStoryReading {
 const article={
  articleId:`article:${edition}:${story}`,editionId:edition,title,deck:"Source-backed details",
  editorial:{readiness:"READY"},
 } as EditorialArticle;
 return {storyId:story,editionId:edition,publishedAt:date,article};
}
test("exact edition and stable Story ID are necessary for history",()=>{
 assert.equal(exactPublishedStoryId(reading(a,e1,"2026-10-20T14:00:00Z","A").article),a);
 assert.equal(exactPublishedStoryId({articleId:`article:${e1}:${b}`,editionId:e2}),null);
 assert.equal(exactPublishedStoryId({articleId:`article:${e1}:not-an-id`,editionId:e1}),null);
});
test("only newest publication is centre-stage, older report is recoverable, page is bounded",()=>{
 const old=reading(a,e1,"2026-10-20T14:00:00Z","Earlier catalyst");
 const current=reading(a,e2,"2026-10-21T14:00:00Z","Fresh catalyst");
 const other=reading(b,e3,"2026-10-22T14:00:00Z","Other Story");
 const readings=[old,current,other];
 const heads=newestStoryReadings(readings);
 assert.deepEqual(heads.map(x=>x.article.title),["Other Story","Fresh catalyst"]);
 assert.deepEqual(readingsForStory(readings,a,e2).map(x=>x.article.title),["Earlier catalyst"]);
 assert.deepEqual(readingsForStory(readings,a,e1),[]);
 assert.deepEqual(paginateStoryReadings(heads,1,1).items.map(x=>x.storyId),[b]);
 assert.deepEqual(paginateStoryReadings(heads,2,1).items.map(x=>x.storyId),[a]);
 assert.equal(paginateStoryReadings(heads,999,1).page,1);
});
test("filtering uses source-owned asset tags and explicit country mentions",()=>{
 assert.equal(storyMatchesSubject("Semiconductor supply","",["NVDA"],"NVDA"),true);
 assert.equal(storyMatchesSubject("Semiconductor supply","",["SMH"],"NVDA"),false);
 assert.equal(storyMatchesSubject("China and the yen","",[],"CN"),true);
 assert.equal(storyMatchesSubject("China and the yen","",[],"JP"),true);
 assert.equal(storyMatchesSubject("Macro uncertain","",[],"NVDA"),false);
});
