import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path:string)=>readFileSync(path,"utf8");
test("Writing Brain's new editorial home is Notion and does not mandate a Supabase slate",()=>{
 const doc=read("docs/editorial/BLUEBELLY_WRITING_BRAIN_NOTION_FIRST_20261108.md");
 assert.match(doc,/Writing Brain — Living Editorial Theses/);
 assert.match(doc,/411519b67a9481fcb612c2d975d7f31d/);
 assert.match(doc,/No daily 3-angle quota|no daily 3-angle quota/);
 assert.match(doc,/Do not write a daily slate to Supabase/);
 assert.match(doc,/A living Notion thesis never becomes a public Story automatically/);
});
test("My Desk provides owner-only Notion handoff without editorial queries or public endpoints",()=>{
 const page=read("app/my-reports/page.tsx");
 assert.match(page,/data-bluebelly-my-reports="owner-only"/);
 assert.match(page,/data-private-desk="source-first-market-workspace"/);
 assert.match(page,/https:\/\/app\.notion\.com\/p\/411519b67a9481fcb612c2d975d7f31d/);
 assert.doesNotMatch(page,/getLatestEditorialSlate|\.from\("blue_desk_editorial_slates"\)|\.upsert\(/);
 const src=read("lib/blue-desk-host.ts");
 assert.match(src,/"\/my-reports"/);
 assert.match(src,/pathname === "\/key-stories"/);
});
test("legacy writing brain evidence and report outputs remain protected but are not the primary workflow",()=>{
 const legacy=read("docs/editorial/BLUEBELLY_WRITING_BRAIN_SOURCE_FIRST_20261106.md");
 assert.match(legacy,/NOTION-FIRST/);
 assert.match(legacy,/blue_desk_editorial_slates/);
 const slate=read("lib/editorial-slate-server.ts");
 assert.match(slate,/"blue_desk_editorial_slates"/);
 const pdf=read("app/api/cron/research/morning-dossier/route.ts");
 assert.match(pdf,/scheduledSourceOnlyEnabled/);
 assert.match(pdf,/BLUEBELLY_ENABLE_LEGACY_PDF/);
});
