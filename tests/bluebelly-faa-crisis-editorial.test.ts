import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {FAA_CRISIS_ID,FAA_CRISIS_AS_OF,faaCrisisNewsroomItem,faaFundingIncrease,faaSystemCondition} from "../lib/bluebelly-faa-crisis-editorial.ts";

test("FAA crisis is source-dated, conditional and exact-reader linked",()=>{
 const start=Date.parse(FAA_CRISIS_AS_OF);
 assert.equal(faaCrisisNewsroomItem(new Date(start-1),"/key-stories"),null);
 const item=faaCrisisNewsroomItem(new Date(start),"/key-stories")!;
 assert.equal(item.readerHref,"/key-stories?feature="+FAA_CRISIS_ID);
 assert.match(item.sourceUrl,/^https:\/\/www\.faa\.gov\//);
 assert.match(item.verificationLabel,/CONDITIONAL OUTLOOK/);
 assert.equal(faaCrisisNewsroomItem(new Date(start+7*86400000),"/key-stories"),null);
 assert.equal(faaFundingIncrease.toFixed(1),"66.1");
 assert.equal(faaSystemCondition.reduce((sum,r)=>sum+r.count,0),138);
});
test("FAA full dated reader preserves ten sections, uncertainty and source links",()=>{
 const article=readFileSync(new URL("../components/blue-desk/FaaCrisisStory.tsx",import.meta.url),"utf8");
 for(const title of ["1. The timeline","2. What actually broke?","3. The government was warned","4. The players and their motivations","5. Follow the money","6. Was the crisis intentional?","7. Market reaction","8. Potential winners and losers","9. Forward-looking scenarios","10. What Bluebelly should monitor"])assert.ok(article.includes(title),title);
 assert.match(article,/12,462/);
 assert.match(article,/11,389/);
 assert.match(article,/No reviewed source establishes deliberate sabotage/);
 assert.match(article,/Requests, not appropriations/);
 const feed=readFileSync(new URL("../lib/bluebelly-public-newsroom-feed.ts",import.meta.url),"utf8");
 const reader=readFileSync(new URL("../app/blue-desk/key-stories/page.tsx",import.meta.url),"utf8");
 assert.match(feed,/faaCrisisNewsroomItem\(now,reader\)/);
 assert.match(reader,/params\?\.feature===FAA_CRISIS_ID/);
});
