import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildPrivateDailyReaderDraft} from "../lib/bluebelly-editorial-draft-preview.ts";
import {renderPrivateEditorialReaderHtml} from "../lib/bluebelly-editorial-reader.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";
function news(kind="official",at="2026-10-30T18:00:00Z"):NewsBriefV1{
 return {
  id:"n1",contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",
  headline:"Original market disclosure and issuer report",summary:"An issuer has published a new, independently sourced financial disclosure.",
  sourceName:"Company investor relations",sourceUrl:"https://investor.example.com/releases/q3-2026",
  sourceKind:kind,occurredAt:at,observedAt:"2026-10-30T18:05:00Z",
  verification:"SOURCE_VERIFIED",
 };
}
const input=(body:string,source:NewsBriefV1[]=[news()])=>({
 title:"A source-qualified market story for today's desk",
 body,asOf:"2026-10-31T03:30:00Z",news:source,
 selectedSourceUrls:["https://investor.example.com/releases/q3-2026"],
});
test("private reader holds full source narrative and does not invent causal citations",()=>{
 const chunks=Array.from({length:20},(_,i)=>"Paragraph "+i+" discusses a financial claim, a countercase and why the next dated source matters. "+("Factual statements remain unverified. ".repeat(6)));
 const full=chunks.join("\n\n");
 const edition=buildPrivateDailyReaderDraft(input(full));
 assert.equal(edition.status,"PRIVATE_DRAFT");
 assert.equal(edition.reportDay,"2026-10-31");
 assert.equal(edition.executiveSummary,chunks[0].trim());
 assert.equal(edition.sources[0].status,"ORIGINAL_VERIFIED");
 assert.ok(edition.sections.length>2,"Long-form is split visually, not condensed");
 const paragraphs=edition.sections.flatMap(s=>s.blocks).filter(b=>b.kind==="paragraph");
 const retained=[edition.executiveSummary,...edition.sections.flatMap(s=>[s.opening,...s.blocks.map(b=>b.kind==="paragraph"?b.text:"")])];
 assert.deepEqual(retained,chunks.map(c=>c.trim()),"Every original paragraph must appear exactly once and in order (ignoring trailing whitespace)");
 assert.ok(paragraphs.every(b=>b.kind==="paragraph"&&b.sourceIds.length===0),
  "Independent news receipt does not verify the author's unrelated narrative");
 const html=renderPrivateEditorialReaderHtml(edition);
 assert.match(html,/Source-qualified packet|independently matched market reaction/i);
 assert.match(html,/Private unapproved draft; not public/);
 assert.ok(html.includes(chunks[19].trim()));
 assert.ok(html.includes("font:18px/1.76"));
});
test("single substantial paragraph remains intact without invented filler",()=>{
 const paragraph="A claim is discussed with its constraint and strongest countercase. ".repeat(18);
 const edition=buildPrivateDailyReaderDraft(input(paragraph));
 assert.equal(edition.sections[0].opening,paragraph.trim());
 assert.equal(edition.sections[0].blocks.length,0);
 assert.equal(edition.executiveSummary.includes("full original text"),true);
});
test("only explicit independent receipt joins qualify; quiet or weak coverage stays visibly unreviewed",()=>{
 const body="Financial analysis explaining competing outcomes in depth. ".repeat(20);
 for(const source of [[],[news("social")],[news("official","2026-10-10T18:00:00Z")]]){
  const draft=buildPrivateDailyReaderDraft(input(body,source));
  assert.equal(draft.sources.length,0);
  const html=renderPrivateEditorialReaderHtml(draft);
  assert.match(html,/No independently source-qualified receipts attached/);
  assert.match(html,/Private unapproved draft; not public/);
 }
 const unrelated=buildPrivateDailyReaderDraft({...input(body),selectedSourceUrls:[]});
 assert.equal(unrelated.sources.length,0,"Unselected verified headlines must not launder an unrelated article");
 const report=buildPrivateDailyReaderDraft(input(body,[news("reporting")]));
 assert.equal(report.sources[0].status,"CORROBORATED");
 const forged=buildPrivateDailyReaderDraft(input(body,[]));forged.status="OWNER_REVIEWED";
 assert.throws(()=>renderPrivateEditorialReaderHtml(forged),/Missing evidence or narrative/);
});
test("snapshot hash binds body, source receipts and clock; no silent rewrite",()=>{
 const body="Market report about issuer economics and financial constraints. ".repeat(20);
 const first=buildPrivateDailyReaderDraft(input(body));
 const repeat=buildPrivateDailyReaderDraft(input(body));
 const revised=buildPrivateDailyReaderDraft(input(body+" New follow-up claims."));
 assert.equal(first.snapshotSha256,repeat.snapshotSha256);
 assert.notEqual(first.snapshotSha256,revised.snapshotSha256);
 assert.match(first.snapshotSha256,/^[\da-f]{64}$/);
});
test("untrusted report text stays escaped in reader, sources never promoted",()=>{
 const body='An <img src=x onerror=alert(1)> claim should not execute. '.repeat(18);
 const html=renderPrivateEditorialReaderHtml(buildPrivateDailyReaderDraft(input(body)));
 assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
 assert.ok(!html.includes("<img src=x onerror=alert(1)>"));
});
test("owner preview API requires exact host gate, same origin and owner allowlist",()=>{
 const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
 const route=read("app/api/owner/editorial-reader-preview/route.ts");
 const host=read("lib/blue-desk-host.ts");
 const writer=read("components/blue-desk/DailyReportWriter.tsx");
 assert.match(route,/blueDeskHostAccess\(path,host\)!=="private"/);
 assert.match(route,/Same-origin browser action required/);
 assert.match(route,/Cross-origin request denied/);
 assert.match(route,/session\.auth\.getUser\(\)/);
 assert.match(route,/app_access_allowlist/);
 assert.match(route,/selectedSourceUrls/);
 assert.match(route,/app_access_allowlist/);
 assert.match(route,/Cache-Control":"private, no-store/);
 assert.ok(host.includes('"/api/owner/editorial-reader-preview"'));
 assert.match(writer,/Preview full draft in Editorial Reader v4/);
 assert.match(writer,/setBody\(e.target.value.slice\(0,75000\)\)/);
 assert.match(writer,/sandbox="allow-scripts allow-popups"/);
 assert.match(writer,/setBody\(e\.target\.value\.slice\(0,75000\)\);setPreviewHtml\(""\)/);
 assert.match(writer,/setSelectedSources\(e\.target\.value\.slice\(0,5500\)\);setPreviewHtml\(""\)/);
 assert.ok(!route.includes('createSupabaseAdminClient'));
});
