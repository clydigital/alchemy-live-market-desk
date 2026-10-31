import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("completed five-chapter generation and full previews both request owner-only automatic archive",()=>{
 const writer=read("components/blue-desk/DailyReportWriter.tsx");
 assert.match(writer,/JSON\.stringify\(\{title:current\.title,body:complete,selectedSources,selectedX,autoArchive:true\}\)/);
 assert.match(writer,/JSON\.stringify\(\{title,body,selectedSources,selectedX,autoArchive:true\}\)/);
 assert.match(writer,/const archiveId=previewResponse\.headers\.get\("X-Bluebelly-Archive-Id"\)/);
 assert.match(writer,/const archiveId=res\.headers\.get\("X-Bluebelly-Archive-Id"\)/);
 assert.match(writer,/setArchivedEditionId\(archiveId\)/);
 assert.match(writer,/Complete HTML was not durably archived/);
 const chapterLoop=writer.indexOf("for(let i=chapters.length;");
 const autoArchiveCall=writer.indexOf("autoArchive:true");
 assert.ok(chapterLoop>0&&autoArchiveCall>chapterLoop,"Autosave only after all chapters are assembled");
 assert.doesNotMatch(writer.slice(chapterLoop,writer.indexOf("const complete=assembleHtmlLongformDraft(chapters)")),/autoArchive:true/);
});
test("renderer persists exact HTML using active owner session and stable source-specific receipt",()=>{
 const route=read("app/api/owner/editorial-reader-preview/route.ts");
 const save=read("lib/bluebelly-autoarchive-rendered-reader.ts");
 assert.match(route,/session\.auth\.getUser\(\)/);
 assert.match(route,/app_access_allowlist/);
 assert.match(route,/Cross-origin request denied/);
 assert.match(route,/autoArchive=input\.autoArchive===true/);
 assert.match(route,/const html=renderPrivateEditorialReaderHtml\(edition\)/);
 assert.match(route,/autoArchive\?await archiveRenderedOwnerReader\(user\.id,edition,html\):null/);
 assert.match(route,/"X-Bluebelly-Archive-Id":receipt\.id/);
 assert.match(route,/Report rendered but automatic private HTML archive failed/);
 assert.match(save,/reader\.status!=="PRIVATE_DRAFT"/);
 assert.match(save,/kind:"BLUEBELLY_AUTOSAVED_READER_V1"/);
 assert.match(save,/sourceManifest=reader\.sources\.map/);
 assert.match(save,/digest\(buffer\)!==saved\.html_sha256/);
 assert.match(save,/\.eq\("owner_user_id",ownerId\)/);
 assert.match(save,/upsert:false/);
 assert.match(save,/review_status:"PRIVATE_DRAFT"/);
 assert.match(save,/\.remove\(\[objectPath\]\)/);
 assert.doesNotMatch(save,/\.update\(/);
 assert.doesNotMatch(save,/\.delete\(/);
});
test("archived success appears immediately and blocks redundant manual archive",()=>{
 const archive=read("components/blue-desk/OwnerHtmlEditionArchive.tsx");
 const writer=read("components/blue-desk/DailyReportWriter.tsx");
 assert.match(writer,/autoArchivedId=\{previewHtml\?archivedEditionId:null\}/);
 assert.match(archive,/useEffect\(\(\)=>\{if\(props\.autoArchivedId\)void refresh\(\);\},\[props\.autoArchivedId,refresh\]\)/);
 assert.match(archive,/Already saved automatically/);
 assert.match(archive,/props\.autoArchivedId&&!supersedesId/);
 assert.match(archive,/No separate upload required/);
 assert.match(archive,/Import HTML report into My Desk/);
});
test("renderer autosave never exposes private file via public routes and retains original review semantics",()=>{
 const host=read("lib/blue-desk-host.ts");
 const route=read("app/api/owner/editorial-reader-preview/route.ts");
 assert.match(host,/"\/api\/owner\/editorial-reader-preview"/);
 assert.match(route,/Cache-Control":"private, no-store/);
 assert.match(route,/if\(blueDeskHostAccess\(path,host\)!=="private"\)/);
 assert.match(route,/status:200,headers/);
 assert.doesNotMatch(route,/NextResponse\.redirect/);
});
