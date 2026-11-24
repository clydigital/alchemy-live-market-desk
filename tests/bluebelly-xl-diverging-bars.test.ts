import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("Compare has a separate full XL chart with a labelled zero-centred axis",()=>{
 const s=readFileSync("components/blue-desk/PublicMarketScreener.tsx","utf8");
 assert.match(s,/projectEtfRotationVisual\(comparisonUniverse,XL_COMPARISON_SYMBOLS,graphicWindow\)/);
 assert.match(s,/data-xl-sector-diverging-bars="same-session"/);
 assert.doesNotMatch(s,/Same-session ETF price-change comparison|Rotation map|5D vs RSP/);
 for(const marker of ["LOSSES ←","0%","→ GAINS","missing-"])assert.ok(s.includes(marker),marker);
});
