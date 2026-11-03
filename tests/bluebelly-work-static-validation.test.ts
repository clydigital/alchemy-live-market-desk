import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {parseExistingHtmlEdition,validateDeliveredWorkHtmlEdition} from "../lib/bluebelly-html-archive-import-contract.ts";
const hash=(s:string)=>createHash("sha256").update(s).digest("hex");
function report(extra="",title="Growth is real. Cash and price tests differ."){
 const prose="<p>Research context and dated market developments are evidence that must be read as separate observation windows. A rate decision can change the discount-rate outlook but does not, without matching quotes, establish a price reaction.</p>".repeat(6);
 return '<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>'+
 title+'</title><style>body{color:#123;background:#fff} .a{padding:1rem}</style></head><body><main><h1>Growth is real. The cash and price tests are different.</h1>'+
 prose+extra+'</main></body></html>';
}
test("service-delivered Work title can be editorial, unlike manual-import branding",()=>{
 const html=report();
 assert.ok(Buffer.byteLength(html,"utf8")>1000);
 const checked=validateDeliveredWorkHtmlEdition({
  html,reportDay:"2026-11-02",title:"Growth is real. The cash and price tests are different. — 2 Nov ET",
 });
 assert.equal(checked.reportDay,"2026-11-02");
 assert.equal(checked.htmlSha256,hash(html));
 assert.throws(()=>parseExistingHtmlEdition({filename:"Bluebelly_2026-11-02.html",html}),/NOT_BLUEBELLY_HTML/);
});
test("Work reader trusts session metadata, not unrelated news dates in HTML",()=>{
 const html=report('<p>Earlier monetary-policy decision on 2026-10-28 is compared with the 2026-11-02 session.</p>');
 const checked=validateDeliveredWorkHtmlEdition({
  html,title:"Daily Intelligence — 2 Nov ET",reportDay:"2026-11-02",
 });
 assert.equal(checked.reportDay,"2026-11-02");
 assert.equal(checked.htmlSha256,hash(html));
});
test("Work reader fails closed on active HTML and invalid or oversized metadata",()=>{
 const input=(html:string,reportDay="2026-11-02")=>({html,reportDay,title:"Complete private Daily Intelligence"});
 for(const bad of [
  report("<script>alert(1)</script>"),
  report('<img src="https://attacker.invalid/collect">'),
  report('<div onclick="alert(1)">bad</div>'),
  report('<style>@import "https://attacker.invalid/x.css";</style>'),
  report("<iframe src='https://attacker.invalid/x'></iframe>"),
  report('<a href="javascript:alert(1)">unsafe</a>'),
  report('<meta http-equiv="refresh" content="0;url=https://attacker.invalid">'),
 ]) assert.throws(()=>validateDeliveredWorkHtmlEdition(input(bad)));
 assert.throws(()=>validateDeliveredWorkHtmlEdition(input(report(),"2026-02-30")));
 assert.throws(()=>validateDeliveredWorkHtmlEdition(input(report(),"2026-11-03 nonsense")));
 assert.throws(()=>validateDeliveredWorkHtmlEdition(input("not a HTML document")));
});
