import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {capexForecast,cumulativeForecastCut,NVIDIA_CRISIS_ID,nvidiaCrisisNewsroomItem} from "../lib/bluebelly-nvidia-crisis-editorial.ts";

test("Nvidia crisis is date-gated, source-backed and routes to its exact edition",()=>{
 assert.equal(nvidiaCrisisNewsroomItem(new Date("2026-11-17T02:59:59Z"),"/key-stories"),null);
 const item=nvidiaCrisisNewsroomItem(new Date("2026-11-17T04:00:00Z"),"/key-stories")!;
 assert.equal(item.readerHref,"/key-stories?feature="+NVIDIA_CRISIS_ID);
 assert.deepEqual(item.topics,["ai","earnings","policy"]);
 assert.match(item.sourceUrl,/^https:\/\/public-inspection\.federalregister\.gov\//);
 assert.match(item.verificationLabel,/CONDITIONAL OUTLOOK/);
 assert.equal(nvidiaCrisisNewsroomItem(new Date("2026-11-24T03:00:00Z"),"/key-stories"),null);
});

test("forecast arithmetic and full seven-section reader preserve the reviewed breakdown",()=>{
 assert.equal(cumulativeForecastCut,1603);
 assert.equal(capexForecast.length,4);
 const article=readFileSync(new URL("../components/blue-desk/NvidiaCrisisStory.tsx",import.meta.url),"utf8");
 for(const title of ["1. Timeline of events","2. The key players and their motivations","3. The bigger political game","4. SemiAnalysis:","5. Forward-looking market scenarios","6. How much damage has already occurred?","7. Upcoming catalysts"]){
  assert.ok(article.includes(title),title);
 }
 assert.match(article,/\$156\.14/);
 assert.match(article,/original subscriber model was not independently retrieved/);
 assert.match(article,/not established private intentions/);
 assert.match(article,/Nvidia crisis/);
 assert.match(article,/Systemic AI crisis/);
});
