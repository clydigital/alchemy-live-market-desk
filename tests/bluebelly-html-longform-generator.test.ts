import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 HTML_LONGFORM_CHAPTERS,isHtmlLongformChapterKey,longformChapterPrompt,
 validateHtmlLongformChapter,assembleHtmlLongformDraft
} from "../lib/bluebelly-html-longform-generator.ts";
const read=(name:string)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const packet=[
 "Source-verified issuer filing dated 2026-10-30: capex $5.4 billion.",
 "Source-verified rate decision dated 2026-10-30: inflation 3.7%.",
 "Attributed creator thesis: see https://www.youtube.com/watch?v=i9IoWYoaiW4. Numbers in creator claims are UNVERIFIED.",
].join("\n");
const report=("A lender may demand a different return even while chip demand continues. The transaction still requires proof, and another explanation is possible. "+
 "The issuer's own documents distinguish accounting earnings from cash actually available to repay lenders. "+
 "A rival hypothesis is a temporary repricing rather than a contraction in real demand. ").repeat(6);
test("five distinct bounded acts support progressive original HTML generation",()=>{
 assert.deepEqual(HTML_LONGFORM_CHAPTERS.map(x=>x.key),[
  "opening","economics","transmission","creator-debate","verdict"]);
 assert.equal(new Set(HTML_LONGFORM_CHAPTERS.map(x=>x.heading)).size,5);
 assert.ok(isHtmlLongformChapterKey("creator-debate"));
 assert.ok(!isHtmlLongformChapterKey("unknown"));
 const prompt=longformChapterPrompt({key:"creator-debate",title:"AI financing and the catch",packet,
  priorContext:"A dated source arrived, but the financing mechanism is unproven.",instructions:"Keep exact source clocks."});
 assert.match(prompt,/original upload|upload time|timecodes/i);
 assert.match(prompt,/UNTRUSTED/);
 assert.ok(prompt.includes("creator-debate")===false,"Model sees chapter name, not control token");
});
test("chapter validation rejects unreceipted monetary claims and social URLs",()=>{
 assert.equal(validateHtmlLongformChapter(report+" 3.7% and $5.4 billion.",packet).includes("3.7%"),true);
 assert.throws(()=>validateHtmlLongformChapter(report+" The result was $97bn.",packet),/LONGFORM_UNRECEIPTED_NUMERIC_CLAIM/);
 assert.throws(()=>validateHtmlLongformChapter(report+" https://fake-bank.example/blog",packet),/LONGFORM_UNRECEIPTED_URL/);
 assert.throws(()=>validateHtmlLongformChapter(report+" <script>alert(1)</script>",packet),/LONGFORM_UNSAFE_MARKUP/);
 assert.throws(()=>validateHtmlLongformChapter("short",packet),/LONGFORM_INCOMPLETE_CHAPTER/);
});
test("longform chapters assemble in one chronological original text without a duplicate opener",()=>{
 const result=assembleHtmlLongformDraft([report,"Second section elaborates the actual lender constraints. "+report]);
 assert.ok(result.startsWith("A lender may demand"));
 assert.match(result,/## Follow the money: revenues, costs and funding/);
 assert.equal(result.split("A lender may demand").length,13,"Each source chapter contains its original six repetitions once");
 assert.throws(()=>assembleHtmlLongformDraft([]),/LONGFORM_INVALID_CHAPTER_COUNT/);
});
test("owner model route and reader export remain no-store/private and HTML only",()=>{
 const route=read("app/api/owner/editorial-longform-chapter/route.ts");
 const host=read("lib/blue-desk-host.ts");
 const writer=read("components/blue-desk/DailyReportWriter.tsx");
 const preview=read("app/api/owner/editorial-reader-preview/route.ts");
 assert.match(route,/blueDeskHostAccess\("\/api\/owner\/editorial-longform-chapter",host\)!=="private"/);
 assert.match(route,/app_access_allowlist/);
 assert.match(route,/Cross-origin request denied/);
 assert.match(route,/LONGFORM_MODEL_TIMEOUT/);
 assert.match(route,/validateHtmlLongformChapter/);
 assert.match(route,/Cache-Control":"private, no-store/);
 assert.doesNotMatch(route,/\.storage\.|\.insert\(|\.upsert\(|runAutomatedDailyPdfReport/);
 assert.match(host,/"\/api\/owner\/editorial-longform-chapter"/);
 assert.match(writer,/Generate full-length HTML report/);
 assert.match(writer,/Continue HTML report/);
 assert.match(writer,/assembleHtmlLongformDraft/);
 assert.match(writer,/setBody\(partial\)/);
 assert.match(writer,/partial\.length>75000/);
 assert.match(writer,/Download HTML report/);
 assert.match(preview,/\.in\("original_url",selectedXUrls\)/);
 assert.match(preview,/original_verified/);
});
test("existing private research handoff includes reviewed, dated creator ideas without canonical promotion",()=>{
 const db=read("lib/bluebelly-private-creator-reviews.ts");
 const packetBuilder=read("lib/daily-report-research-packet.ts");
 const owner=read("app/api/owner/daily-research/route.ts");
 assert.match(db,/\.eq\("transcript_status","ready"\)/);
 assert.match(db,/\.eq\("video_review_status","reviewed"\)/);
 assert.match(db,/\.gte\("published_at",cutoff\)/);
 assert.match(db,/\.limit\(25\)/);
 assert.match(packetBuilder,/ATTRIBUTED \/ NOT ORIGINAL FACTS/);
 assert.match(packetBuilder,/CREATOR TRANSCRIPT COVERAGE/);
 assert.match(packetBuilder,/Verification|verification target|Independent source target/i);
 assert.match(owner,/getPrivateReviewedCreatorArguments\(now\)/);
 assert.match(owner,/creatorReviewCoverage/);
});
