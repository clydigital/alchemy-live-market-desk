import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {
 validPublicationId,parseReviewedSubmission,isLikelyPdf,
} from "../lib/editorial-publications.ts";
import {blueDeskHostAccess,blueDeskPresentationTarget} from "../lib/blue-desk-host.ts";
const id="a2f040b6-1c87-48a4-9fe8-72f54398661a";
const sec="https://www.sec.gov/Archives/edgar/data/1326801/000132680126000999/meta.html";
const data={kind:"OB",title:"Meta's Cash Flow Cannot Prove AI Borrowing",meta:"Cash investments and lease principal differ.",
 body:"The SEC-derived quarterly CFO minus cash purchases of PP&E is a simple cash-flow measure. "+
  "It is not issuer-defined FCF. Do not infer that financing for AI projects is already constrained. ".repeat(5),
 sources:sec};
test("owner-reviewed report parser bounds original source URLs, word counts and unsupported claims",()=>{
 const result=parseReviewedSubmission(data);
 assert.equal(result?.kind,"OB");
 assert.equal(result?.source_urls[0],sec);
 assert.match(result?.body||"",/SEC-derived/);
 assert.equal(parseReviewedSubmission({...data,kind:"IMPACT"}),null);
 assert.equal(parseReviewedSubmission({...data,title:"x".repeat(64)}),null);
 assert.equal(parseReviewedSubmission({...data,body:"short"}),null);
 assert.equal(parseReviewedSubmission({...data,sources:"https://localhost/private"}),null);
 assert.equal(parseReviewedSubmission({...data,sources:"https://bad.example/foo"}),null);
 assert.equal(parseReviewedSubmission({...data,sources:""}),null);
});
test("PDF signature and trailer are required, not only a MIME type or filename",()=>{
 const prefix=new TextEncoder().encode("%PDF-1.7\n"+"a".repeat(650)+"\n%%EOF\n");
 assert.equal(isLikelyPdf(prefix),true);
 assert.equal(isLikelyPdf(new TextEncoder().encode("a".repeat(650)+"\n%%EOF")),false);
 assert.equal(isLikelyPdf(new TextEncoder().encode("%PDF-1.7\n"+"a".repeat(650))),false);
 assert.equal(isLikelyPdf(new Uint8Array(3145729)),false);
});
test("COTD/OB and PDF library moved from public visitor routes to signed-in private host",()=>{
 for(const path of ["/reports","/blue-desk/reports","/reports/"+id,
  "/reports/"+id+"/pdf"]){
  assert.equal(blueDeskHostAccess(path,"bluebelly-desk.vercel.app"),"blocked");
  assert.equal(blueDeskHostAccess(path,"alchemy-live-market-desk.vercel.app"),"private");
  assert.equal(blueDeskPresentationTarget(path,"bluebelly-desk.vercel.app"),null);
  assert.equal(blueDeskHostAccess(path,"private-preview.vercel.app"),"private");
 }
 assert.equal(blueDeskHostAccess("/owner/daily-articles","bluebelly-desk.vercel.app"),"blocked");
 assert.equal(blueDeskHostAccess("/owner/daily-articles","private-preview.vercel.app"),"private");
 assert.equal(blueDeskHostAccess("/api/owner/editorial-publish","alchemy-live-market-desk.vercel.app"),"private");
 assert.equal(blueDeskHostAccess("/owner/publications","alchemy-live-market-desk.vercel.app"),"private");
 assert.equal(validPublicationId("not-uuid"),false);
 assert.equal(validPublicationId(id),true);
});
test("private desk blocks all new report publications at the server endpoint",()=>{
 const src=readFileSync(new URL("../app/api/owner/editorial-publish/route.ts",import.meta.url),"utf8");
 const owner=readFileSync(new URL("../app/owner/publications/page.tsx",import.meta.url),"utf8");
 const header=readFileSync(new URL("../components/blue-desk/BlueDeskHeader.tsx",import.meta.url),"utf8");
 assert.match(src,/status:410/);
 assert.match(src,/Public report publication is disabled/);
 assert.doesNotMatch(src,/storage\\.from|\\.insert\\(|status:"published"/);
 assert.match(owner,/Reports are private/);
 assert.doesNotMatch(owner,/ReportPublisher/);
 const privateNav=header.match(/const PRIVATE_NAV = \\[([\\s\\S]*?)\\] as const;/)?.[1]||"";
 assert.doesNotMatch(privateNav,/Publish Reports|\\/owner\\/publications/);
});
test("publication SQL uses RLS public approved read only, private bucket, no anon writes",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261025094500_editorial_publications.sql",import.meta.url),"utf8");
 assert.match(sql,/alter table public\.editorial_publications enable row level security/);
 assert.match(sql,/using \(status='published'\)/);
 assert.match(sql,/revoke all on public\.editorial_publications from anon,authenticated/);
 assert.match(sql,/grant select \(/);
 assert.doesNotMatch(sql,/grant insert|grant update|grant delete/i);
 assert.match(sql,/values\('editorial-pdfs','editorial-pdfs',false/);
 assert.match(sql,/pdf_sha256/);
 assert.doesNotMatch(sql,/story_thesis_versions|market_motion_items|research_runs/);
});
test("public report HTML is exact published-only, PDF download validates record+path and does not leak storage",()=>{
 const r=readFileSync(new URL("../lib/editorial-publications-server.ts",import.meta.url),"utf8");
 const page=readFileSync(new URL("../app/blue-desk/reports/[id]/page.tsx",import.meta.url),"utf8");
 const pdf=readFileSync(new URL("../app/blue-desk/reports/[id]/pdf/route.ts",import.meta.url),"utf8");
 assert.match(r,/getSupabasePublicConfig/);
 assert.match(r,/\.eq\("status","published"\)/);
 assert.doesNotMatch(r,/createSupabaseAdminClient|SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(page,/getPublishedReport/);
 assert.match(page,/Original source links/);
 assert.match(pdf,/\.eq\("status","published"\)/);
 assert.match(pdf,/startsWith\(expected\)/);
 assert.match(pdf,/Content-Type":"application\/pdf"/);
 assert.match(pdf,/Content-Disposition/);
 assert.match(pdf,/X-Content-Type-Options/);
});
