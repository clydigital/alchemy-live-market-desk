import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const component=readFileSync(new URL("../components/blue-desk/OwnerTechnicalLevels.tsx",import.meta.url),"utf8");
const page=readFileSync(new URL("../app/market-tools/page.tsx",import.meta.url),"utf8");
test("technical terminal uses canonical homepage styling and event-first layout",()=>{
 assert.ok(component.includes("market-first-home.module.css"));
 for(const section of ["home.hero","home.panel","home.quote","home.item"])assert.ok(component.includes(section));
 assert.ok(component.indexOf('id="technical-events"')<component.indexOf('id="technical-structure"'));
 assert.match(component,/open=\{f.frame==="1day"\|\|undefined\}/);
});
test("manual provider requests, owner gate, and data limitations are preserved",()=>{
 assert.ok(component.includes('name="technical"'));
 assert.ok(component.includes('name="fourh"'));
 assert.ok(component.includes("Missing or indicative data is not a verified no-signal verdict"));
 assert.ok(component.includes("not an automatic universe-wide scanner"));
 assert.ok(component.includes("SHORT_WARMUP"));
 assert.ok(page.indexOf("if(!access.ok)return")<page.indexOf("await readTechnicalSnapshot(ticker)"));
});
