import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {uniquePrivateDailyIntelligence,type PrivateDailyIntelligenceEdition}
 from "../lib/bluebelly-private-edition-dedupe.ts";

const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const base:PrivateDailyIntelligenceEdition={
 id:"a866f73b-b1ce-4da3-8d5d-2991fe961f26",title:"AI's cash test: the quarter was strong. Why did stocks fall?",
 reportDay:"2026-10-30",createdAt:"2026-10-31T09:11:09.333Z",
 htmlSha256:"416961ffcc736a6dc216ce2a51a18184f61102eaf4d928d755b318f1f6e42efa",
 reviewStatus:"PRIVATE_DRAFT",delivery:"WORK",
};
test("same byte-identical private HTML stored in Work and owner bucket appears once",()=>{
 const duplicate:PrivateDailyIntelligenceEdition={...base,
  id:"65a0ecf4-2651-4d12-9611-494679bc3daa",delivery:"MY_DESK",
  createdAt:"2026-10-31T08:57:30Z"};
 const result=uniquePrivateDailyIntelligence([duplicate,base]);
 assert.equal(result.editions.length,1);
 assert.equal(result.duplicatesHidden,1);
 assert.equal(result.editions[0].id,base.id);
});
test("distinct corrections retain separate hashes and latest report day wins",()=>{
 const newer={...base,id:"10000000-0000-4000-8000-000000000001",
  reportDay:"2026-10-31",htmlSha256:"d".repeat(64),createdAt:"2026-10-31T12:00:00Z"};
 const revised={...base,id:"10000000-0000-4000-8000-000000000002",
  htmlSha256:"c".repeat(64),createdAt:"2026-10-31T11:00:00Z"};
 const result=uniquePrivateDailyIntelligence([base,newer,revised]);
 assert.deepEqual(result.editions.map(x=>x.id),[newer.id,revised.id,base.id]);
 assert.equal(result.duplicatesHidden,0);
});
test("My Desk puts the latest report before inline suggestions and removes old archives",()=>{
 const p=read("app/my-reports/page.tsx");
 const main=p.indexOf("<OwnerDailyIntelligenceHome/>");
 const ideas=p.indexOf("<OwnerDailyTopicIdeas/>");
 assert.ok(main>0&&ideas>main);
 assert.match(p,/data-my-desk-secondary="daily-report-to-ob-cotd"/);
 assert.doesNotMatch(p,/OwnerEditorialSlateHtml|legacy-drive-and-research|manual-research|OwnerEditorialSlatePdfReader/);
 const reader=read("components/blue-desk/OwnerDailyIntelligenceHome.tsx");
 assert.match(reader,/postCutoverDailyArchive\(previous\)/);
 assert.match(reader,/data-my-desk-archive="post-cutover-daily-reports-only"/);
});
test("My Desk reads both owner-only private stores rather than the legacy Drive registry",()=>{
 const h=read("lib/bluebelly-owner-daily-intelligence.ts");
 const card=read("components/blue-desk/OwnerDailyIntelligenceHome.tsx");
 assert.match(h,/session\.auth\.getUser\(\)/);
 assert.match(h,/app_access_allowlist/);
 assert.match(h,/\.eq\("owner_user_id",user\.id\)/);
 assert.match(h,/blue_desk_work_html_editions/);
 assert.match(h,/blue_desk_private_html_editions/);
 assert.match(h,/uniquePrivateDailyIntelligence\(rows\)/);
 assert.match(card,/Latest saved report/);
 assert.match(card,/OwnerPrivateHtmlInlineReader/);
 assert.match(card,/No saved Daily Intelligence edition yet/);
 assert.match(card,/Private draft, not publicly published/);
});
test("inline report reader uses owner-authenticated archive bytes in opaque sandbox without script permission",()=>{
 const reader=read("components/blue-desk/OwnerPrivateHtmlInlineReader.tsx");
 assert.match(reader,/\/api\/owner\/html-editions\?edition=/);
 assert.match(reader,/credentials:"same-origin",cache:"no-store"/);
 assert.match(reader,/sandbox="allow-popups"/);
 assert.match(reader,/srcDoc=\{html\}/);
 assert.match(reader,/http-equiv="Content-Security-Policy"/);
 assert.match(reader,/default-src &\#39;none&\#39;/);
 assert.match(reader,/setHtml\(result\.replace\(/);
 assert.doesNotMatch(reader,/allow-scripts|allow-same-origin/);
 assert.match(reader,/integrity-checked archive/);
});
