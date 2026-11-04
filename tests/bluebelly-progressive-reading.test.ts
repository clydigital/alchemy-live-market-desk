import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("public Today presents the existing qualified stories in three reading depths",()=>{
 const reader=read("components/blue-desk/ProgressiveTodayReader.tsx");
 const home=read("app/blue-desk/page.tsx");
 assert.match(reader,/decisionTopics\(news,calendar,now\)/);
 assert.match(reader,/filter\(item=>item\.status!=="UPCOMING"\)/);
 assert.match(reader,/lead\.status==="UPCOMING"/);
 assert.match(reader,/data-progressive-reading="today-v1"/);
 assert.match(reader,/href="#today-headlines"/);
 assert.match(reader,/id="today-headlines"/);
 assert.match(reader,/<details className=\{styles\.expansion\}>/);
 assert.match(reader,/item\.mechanism/);
 assert.match(reader,/item\.test/);
 assert.match(reader,/item\.sourceUrl/);
 assert.match(reader,/selectBlueDeskUpcoming\(calendar,now,7\)\.slice\(0,3\)/);
 assert.match(home,/publicHost\?<ProgressiveTodayReader/);
 assert.match(home,/data-home-detailed-brief="on-demand"/);
 assert.match(home,/data-home-archive="on-demand"/);
 assert.match(home,/!publicHost\?<CurrentMarketUpdates/);
});

test("Newsroom and Key Stories retain source provenance behind accessible disclosures",()=>{
 const wire=read("components/blue-desk/BluebellyNewsWire.tsx");
 const stories=read("app/blue-desk/key-stories/page.tsx");
 const header=read("components/blue-desk/BlueDeskHeader.tsx");
 assert.match(wire,/data-progressive-news="source-only"/);
 assert.match(wire,/Explain the market implications and next test/);
 assert.match(wire,/SourceOnlyConsequence news=\{card\.item\}/);
 assert.match(wire,/card\.item\.sourceUrl/);
 assert.match(stories,/data-progressive-stories="coverage-on-demand"/);
 assert.match(stories,/Evidence, counterargument and next test/);
 assert.match(stories,/topic\.guidingQuestion/);
 assert.match(stories,/thesis\.contradiction/);
 assert.match(header,/const PUBLIC_MORE = \[/);
 assert.match(header,/more\.map\(\(\[label,path\]\)=>/);
 assert.match(header,/ownerWorkspace/);
});
