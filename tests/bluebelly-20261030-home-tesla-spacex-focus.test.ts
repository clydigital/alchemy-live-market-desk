import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("public Bluebelly ends after editorial recap; dedicated Markets keeps its data reader",()=>{
 const home=source("app/blue-desk/page.tsx");
 const markets=source("app/blue-desk/markets/page.tsx");
 assert.match(home, /\{!publicHost \? <>/);
 assert.match(home, /<DecisionBrief news=\{verifiedNews\}/);
 assert.match(markets, /getMarketMonitor\(\)/);
 assert.match(markets, /<PublicMarketScreener/);
 assert.match(markets, /<details id="earnings-research"/);
});

test("last-seven-days reports link to real approved on-site readers",()=>{
 const home=source("components/blue-desk/DecisionBrief.tsx");
 const recap=source("lib/bluebelly-post-event-recap.ts");
 const reader=source("app/blue-desk/key-stories/page.tsx");
 assert.match(home,/data-bluebelly-released-reading="links-only"/);
 assert.match(home,/postEventRecaps.slice\(1\)\.map/);
 assert.match(home,/moreCards.map/);
 assert.match(home,/<Link href=\{n\.href\}>Read Bluebelly recap/);
 assert.match(home,/<Link href=\{reader\+r\.detailsHref\}>/);
 assert.doesNotMatch(home,/<EarningsEvidenceGraphic scorecard=\{r\}/);
 assert.match(recap,/detailsHref:"\?postEvent="/);
 assert.match(reader,/params\.postEvent/);
 assert.match(reader,/findPostEventRecap/);
});

test("Tesla SpaceX AI financing context stays source-dated and separate from merger speculation",()=>{
 const watch=source("app/blue-desk/regime-watch/page.tsx");
 assert.match(watch,/data-bluebelly-ai-financing-watch="source-dated-adjacent-exposure"/);
 assert.match(watch,/\$40bn master finance lease/);
 assert.match(watch,/Q3 revenue of \$28\.046bn/);
 assert.match(watch,/\$2\.00bn investment in SpaceX common stock/);
 assert.match(watch,/A Tesla–SpaceX merger is a scenario/);
 assert.match(watch,/ir\.spacex\.com\/updates\/releases-details\/2026/);
 assert.match(watch,/sec\.gov\/Archives\/edgar\/data\/1318605/);
});
