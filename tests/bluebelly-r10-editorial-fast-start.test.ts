import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("source-pack starter is edition-pinned, local-only and never overwrites an existing draft",()=>{
 const c=read("components/blue-desk/PresenterEditorialDraftEditor.tsx");
 const p=read("app/blue-desk/presenter/editorial/page.tsx");
 assert.match(c,/sourcePackOutline\(kind,sourcePack\)/);
 assert.match(c,/if\(body\.trim\(\)\)return/);
 assert.match(c,/disabled=\{Boolean\(body\.trim\(\)\)\}/);
 assert.match(c,/RESEARCH OUTLINE ONLY — NOT APPROVED FOR PUBLICATION/);
 assert.match(c,/Verify exact session and chart/);
 assert.match(p,/sourcePack=\{\{headline:lane\.headline,editionId:lane\.editionId,dossierId:lane\.dossierId,snippets:lane\.snippets\}\}/);
 assert.doesNotMatch(c,/\.insert\(|\.upsert\(|fetch\(|localStorage\.setItem/);
});
