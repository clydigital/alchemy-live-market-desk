import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {datedNewsSourceExcerpt} from "../lib/bluebelly-dated-news-excerpt.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";
const base={verification:"SOURCE_VERIFIED",headline:"Bank of Canada raises its policy rate",summary:"The Bank of Canada raised its policy rate by 25 basis points to 2.5%, with the deposit rate at 2.45%."} as Pick<NewsBriefV1,"verification"|"headline"|"summary">;
test("seven-day news cards display substantive source-qualified findings",()=>{
 assert.equal(datedNewsSourceExcerpt(base),base.summary);
 assert.equal(datedNewsSourceExcerpt({...base,verification:"UNVERIFIED"} as unknown as typeof base),null);
 assert.equal(datedNewsSourceExcerpt({...base,summary:base.headline}),null);
 assert.equal(datedNewsSourceExcerpt({...base,summary:"The original publisher issued this dated announcement. Its market-price reaction and wider causal effects have not been established."}),null);
 const clipped=datedNewsSourceExcerpt({...base,summary:"A".repeat(800)});
 assert.equal(clipped?.length,478);
 assert.ok(clipped?.endsWith("…"));
});
test("Key Stories reader shows evidence and keeps the price-reaction disclaimer",()=>{
 const source=readFileSync(new URL("../app/blue-desk/key-stories/page.tsx",import.meta.url),"utf8");
 assert.match(source,/data-source-confirmed-excerpt="true"/);
 assert.match(source,/What the source reports:/);
 assert.match(source,/Prior expectations, like-for-like comparisons and actual market response remain separate research checks/);
 assert.match(source,/verified original analysis/);
 assert.match(source,/datedNewsSourceExcerpt\(n\)/);
});
