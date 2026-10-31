import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("Work HTML inbox is service-only, owner-scoped and immutable",()=>{
 const sql=read("supabase/migrations/20261031085200_private_work_html_inbox.sql");
 assert.match(sql,/create table if not exists public\.blue_desk_work_html_editions/i);
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/revoke all on public\.blue_desk_work_html_editions from public,anon,authenticated/i);
 assert.match(sql,/grant select,insert on public\.blue_desk_work_html_editions to service_role/i);
 assert.match(sql,/before update or delete on public\.blue_desk_work_html_editions/i);
 assert.match(sql,/unique\(owner_user_id,content_sha256\)/);
 assert.match(sql,/PRIVATE_DRAFT/);
 assert.match(sql,/octet_length\(html_content\) between 1000 and 950000/);
 assert.doesNotMatch(sql,/create policy/i);
});
test("auto-delivered editions use the existing authenticated owner archive, with checksum and static-content validation",()=>{
 const route=read("app/api/owner/html-editions/route.ts");
 assert.match(route,/session\.auth\.getUser\(\)/);
 assert.match(route,/app_access_allowlist/);
 assert.match(route,/blueDeskHostAccess\("\/api\/owner\/html-editions",host\)/);
 assert.match(route,/db\.from\("blue_desk_work_html_editions"\)/);
 assert.match(route,/\.eq\("owner_user_id",identity\.userId\)/);
 assert.match(route,/parseExistingHtmlEdition\(\{/);
 assert.match(route,/digest\(workBytes\)!==work\.html_sha256/);
 assert.match(route,/Content-Security-Policy/);
 assert.match(route,/sandbox allow-popups; default-src 'none'/);
 assert.match(route,/status:"PRIVATE_ARCHIVE"/);
 assert.match(route,/\.sort\(\(a,b\)=>b\.created_at\.localeCompare\(a\.created_at\)\)/);
 assert.doesNotMatch(route,/NextResponse\.redirect/);
});
test("Work-delivered files appear in same My Desk reader list but cannot be mistaken for independent sources",()=>{
 const widget=read("components/blue-desk/OwnerHtmlEditionArchive.tsx");
 assert.match(widget,/Automatically delivered from Work/);
 assert.match(widget,/Work-delivered private HTML/);
 assert.match(widget,/e\.delivery_type!=="CHATGPT_WORK"/);
 assert.match(widget,/Read archived HTML/);
 assert.match(widget,/Download exact edition/);
});
test("Work handoff contract does not use a sixth schedule or broad public write endpoint",()=>{
 const doc=read("docs/editorial/BLUEBELLY_WORK_HTML_AUTODELIVERY_20261031.md");
 assert.match(doc,/Supabase/);
 assert.match(doc,/CHATGPT_WORK/);
 assert.match(doc,/single active owner/);
 assert.match(doc,/PRIVATE_DRAFT/);
 assert.match(doc,/No new schedule/);
});
