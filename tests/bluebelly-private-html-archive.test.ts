import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 archivePath,parseArchiveInput,validArchiveId,digest,HTML_BUCKET,HTML_TABLE
} from "../lib/bluebelly-private-html-archive-contract.ts";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const owner="0e43cb9c-e3f5-4375-a2bc-744df429cff0";
const edition="1e15c285-d29c-4762-b559-b00055035fd9";
const fullText=("A dated explanation of investor cash flows, underlying constraints, "+
 "a competing hypothesis and the original-source verification question. ").repeat(6);

test("HTML archive path is deterministic, owner-specific and contains only validated UUIDs",()=>{
 const path=archivePath(owner,"2026-10-31",edition);
 assert.equal(path,"private-html/"+owner+"/2026-10-31/"+edition+".html");
 assert.equal(HTML_BUCKET,"editorial-html");
 assert.equal(HTML_TABLE,"blue_desk_private_html_editions");
 assert.ok(validArchiveId(edition));
 assert.ok(!validArchiveId("../../private"));
 assert.throws(()=>archivePath("someone","2026-10-31",edition),/INVALID_ARCHIVE_PATH/);
 assert.throws(()=>archivePath(owner,"../../../",edition),/INVALID_ARCHIVE_PATH/);
});
test("owner request accepts a bounded article and optional owned correction identity",()=>{
 const x=parseArchiveInput({
  title:"A real source-dated market report",body:fullText,
  selectedSources:"https://example.com/filing",selectedX:"",supersedesId:edition,
 });
 assert.equal(x.supersedesId,edition);
 assert.equal(x.body,fullText.trim());
 assert.throws(()=>parseArchiveInput({title:"Short",body:fullText,selectedX:"",selectedSources:""}),/INVALID_ARCHIVE_INPUT/);
 assert.throws(()=>parseArchiveInput({title:"A real market report",body:"short",selectedX:"",selectedSources:""}),/INVALID_ARCHIVE_INPUT/);
 assert.throws(()=>parseArchiveInput({title:"A real market report",body:fullText,selectedX:"",selectedSources:"",supersedesId:"../other"}),/INVALID_ARCHIVE_INPUT/);
 assert.throws(()=>parseArchiveInput({title:"A real market report",body:fullText,selectedX:"x".repeat(3501),selectedSources:""}),/INVALID_ARCHIVE_INPUT/);
});
test("HTML integrity hash is full SHA-256 over exact original bytes",()=>{
 assert.equal(digest("ABC"),"b5d4045c3f466fa91fe2cc6abe79232a1a57cdf104f7a26e716e0a1e2789df78");
 assert.notEqual(digest("<html>same</html>"),digest("<html>same </html>"));
});
test("database makes editions append-only with no anonymous grants or storage public access",()=>{
 const sql=read("supabase/migrations/20261031064000_private_html_immutable_editions.sql");
 assert.match(sql,/create table if not exists public\.blue_desk_private_html_editions/i);
 assert.match(sql,/constraint blue_desk_private_html_owner_content_unique unique\(owner_user_id,content_sha256\)/);
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/revoke all on public\.blue_desk_private_html_editions from public,anon,authenticated/i);
 assert.match(sql,/before update or delete on public\.blue_desk_private_html_editions/i);
 assert.match(sql,/using errcode='23514'/i);
 assert.match(sql,/values \('editorial-html','editorial-html',false/i);
 assert.doesNotMatch(sql,/create policy/i);
 assert.match(sql,/\\.html\$/);
});
test("archive API independently authenticates all methods, checks ownership and exact bytes",()=>{
 const route=read("app/api/owner/html-editions/route.ts");
 const host=read("lib/blue-desk-host.ts");
 const service=read("lib/bluebelly-private-html-archive.ts");
 assert.match(route,/session\.auth\.getUser\(\)/);
 assert.match(route,/app_access_allowlist/);
 assert.match(route,/blueDeskHostAccess\("\/api\/owner\/html-editions",host\)/);
 assert.match(route,/Cross-origin request denied/);
 assert.match(route,/\.eq\("owner_user_id",identity\.userId\)/);
 assert.match(route,/archivePath\(identity\.userId,edition\.report_day,id\)/);
 assert.match(route,/digest\(new Uint8Array\(bytes\)\)!==edition\.html_sha256/);
 assert.match(route,/Content-Security-Policy/);
 assert.match(route,/sandbox allow-popups; default-src 'none'/);
 assert.match(route,/Cache-Control":"private, no-store/);
 assert.match(host,/"\/api\/owner\/html-editions"/);
 assert.match(service,/upload\(path,new TextEncoder\(\)\.encode\(built\.html\)/);
 assert.match(service,/upsert:false/);
 assert.match(service,/\.remove\(\[path\]\)/);
 assert.match(service,/supersedes_id:input\.supersedesId/);
 assert.doesNotMatch(service,/\.update\(/);
 assert.doesNotMatch(route,/NextResponse\.redirect/);
});
test("reader history offers exact saved HTML and linked corrections without public publication",()=>{
 const component=read("components/blue-desk/OwnerHtmlEditionArchive.tsx");
 const writer=read("components/blue-desk/DailyReportWriter.tsx");
 assert.match(component,/Archive current HTML report/);
 assert.match(component,/Save correction as new HTML edition/);
 assert.match(component,/supersedesId:supersedesId\|\|null/);
 assert.match(component,/Read archived HTML/);
 assert.match(component,/Download exact edition/);
 assert.match(component,/source_manifest\.map/);
 assert.match(writer,/OwnerHtmlEditionArchive/);
 assert.match(writer,/previewReady=\{Boolean\(previewHtml\)\}/);
});
