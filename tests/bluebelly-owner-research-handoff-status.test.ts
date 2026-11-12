import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("Research handoff status stays owner-only and separates review from publication",()=>{
 const page=read("app/owner/research/page.tsx");
 const source=read("lib/bluebelly-owner-research-handoff-status.ts");
 assert.match(page,/data-owner-research-handoff="source-to-publication-readonly"/);
 assert.match(page,/getOwnerResearchHandoffStatus/);
 assert.match(source,/import "server-only"/);
 assert.match(source,/\.eq\("status","review"\)/);
 assert.match(source,/\.eq\("status","published"\)/);
 assert.match(source,/intelligence_engine_runs/);
 assert.match(page,/No research or regime state is changed by this panel/);
 const publicPage=read("app/blue-desk/newsroom/page.tsx");
 assert.doesNotMatch(publicPage,/getOwnerResearchHandoffStatus|bluebelly-owner-research-handoff-status/);
 assert.doesNotMatch(source,/\.insert\(|\.upsert\(|\.update\(/);
});
