import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 parseExistingHtmlEdition,
} from "../lib/bluebelly-html-archive-import-contract.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const example=String.raw`<!DOCTYPE html><html lang="en-GB"><head>
<title>Bluebelly Daily Intelligence — 30 Oct 2026</title>
<style>body{font-size:18px}.main{max-width:795px}</style></head><body>
<main class="main"><h1>AI's cash test:<br/>Why did stocks fall?</h1>
<div class="reading-banner">PRIVATE · MANUAL · NOT LIVE</div>
<section id="creator"><h2>Creator reasoning</h2>
<p>Paragraph about the market, investor doubts and future cash flow.</p>
<p>A second paragraph compares company cash generation, infrastructure commitments and creditor sensitivity without asserting an unsupported conclusion. A second paragraph compares company cash generation, infrastructure commitments and creditor sensitivity without asserting an unsupported conclusion. A second paragraph compares company cash generation, infrastructure commitments and creditor sensitivity without asserting an unsupported conclusion. A second paragraph compares company cash generation, infrastructure commitments and creditor sensitivity without asserting an unsupported conclusion. </p>
<figure><svg viewBox="0 0 100 100"><rect width="20" height="20" /></svg></figure>
<a href="https://www.reuters.com/">Original reporting</a>
<blockquote><a href="https://x.com/example/status/2116167673822183644">Open original X post</a></blockquote>
</section></main>
<script async src="https://platform.twitter.com/widgets.js"></script></body></html>`;

test("HTML owner import preserves the complete reader, SVG, links and static X fallback",()=>{
 const {input,edition}=parseExistingHtmlEdition({mode:"existing_html",
  filename:"Bluebelly_Daily_Intelligence_2026-10-30_Editorial_Reader_v4_Corrected(1).html",
  html:example,supersedesId:null,
 });
 assert.equal(edition.reportDay,"2026-10-30");
 assert.equal(edition.title,"AI's cash test: Why did stocks fall?");
 assert.match(edition.html,/<svg viewBox=/);
 assert.match(edition.html,/class="reading-banner"/);
 assert.match(edition.html,/https:\/\/x.com\/example\/status/);
 assert.match(edition.html,/https:\/\/www.reuters.com/);
 assert.match(input.html,/<section id="creator">/);
 assert.doesNotMatch(edition.html,/<script\b/i);
 assert.equal(edition.htmlSha256.length,64);
});
test("import remains idempotent but keeps distinct report dates and correction identities",()=>{
 const a=parseExistingHtmlEdition({filename:"Bluebelly_2026-10-30.html",html:example});
 const b=parseExistingHtmlEdition({filename:"Bluebelly_2026-10-30.html",html:example});
 const c=parseExistingHtmlEdition({filename:"Bluebelly_2026-10-31.html",html:example});
 const d=parseExistingHtmlEdition({filename:"Bluebelly_2026-10-30.html",html:example,
  supersedesId:"1e15c285-d29c-4762-b559-b00055035fd9"});
 assert.equal(a.edition.contentSha256,b.edition.contentSha256);
 assert.notEqual(a.edition.contentSha256,c.edition.contentSha256);
 assert.notEqual(a.edition.contentSha256,d.edition.contentSha256);
});
test("import refuses active resources and masquerading unrelated reports",()=>{
 const data=(html:string,filename="Bluebelly_2026-10-30.html")=>({filename,html});
 assert.throws(()=>parseExistingHtmlEdition(data(example.replace("Bluebelly Daily","Other Daily"))),/NOT_BLUEBELLY_HTML/);
 assert.throws(()=>parseExistingHtmlEdition(data(example.replace('class="main"',`onload="alert(1)" class="main"`))),/ACTIVE_HTML_NOT_ALLOWED/);
 assert.throws(()=>parseExistingHtmlEdition(data(example.replace('href="https://www.reuters.com/"','href="javascript:alert(1)"')),/ACTIVE_HTML_NOT_ALLOWED/);
 assert.throws(()=>parseExistingHtmlEdition(data(example,"../../report.html")) ,/INVALID_HTML_FILE/);
 assert.throws(()=>parseExistingHtmlEdition(data(example,"Bluebelly_2026-02-30.html")) ,/HTML_REPORT_DAY_MISSING/);
});
test("import is authenticated owner-only and never grants imported links independent verification",()=>{
 const route=read("app/api/owner/html-editions/route.ts");
 const service=read("lib/bluebelly-private-html-import.ts");
 const ui=read("components/blue-desk/OwnerHtmlEditionArchive.tsx");
 assert.match(route,/session\.auth\.getUser\(\)/);
 assert.match(route,/app_access_allowlist/);
 assert.match(route,/Cross-origin request denied/);
 assert.match(route,/importExistingHtmlEdition\(identity\.userId,payload\)/);
 assert.match(route,/expected a dated, static Bluebelly HTML reader/);
 assert.match(service,/\.eq\("owner_user_id",ownerId\)/);
 assert.match(service,/source_manifest:\[\]/);
 assert.match(service,/review_status:"PRIVATE_DRAFT"/);
 assert.match(service,/upsert:false/);
 assert.match(service,/\.remove\(\[path\]\)/);
 assert.match(ui,/Import HTML report into My Desk/);
 assert.match(ui,/type="file" accept="\.html,\.htm,text\/html"/);
 assert.match(ui,/mode:"existing_html"/);
 assert.doesNotMatch(service,/\.update\(/);
});
