import {test} from "node:test";
import {strict as assert} from "node:assert";
import {attachmentObjectName,attachmentOwnerPrefix,looksLikePdf,validAttachmentName,
 REPORT_ATTACHMENT_MAX_BYTES} from "../lib/bluebelly-owner-report-attachment-contract.ts";
const OWNER="2a7653d1-74a1-4e78-b950-237f4e448e74";
const ID="2af63a16-a2e9-4e28-a739-0004862d873f";
test("private Daily Report paths are owner-scoped, sanitised and dated",()=>{
 assert.equal(attachmentOwnerPrefix(OWNER),"private-daily-research/"+OWNER);
 assert.throws(()=>attachmentOwnerPrefix("../outsider"));
 const name=attachmentObjectName("2026-11-02","Bluebelly AI & Hormuz chart packet.pdf",ID);
 assert.equal(name,"2026-11-02--bluebelly-ai-hormuz-chart-packet--"+ID+".pdf");
 assert.ok(validAttachmentName(name));
 for(const bad of ["../../x.pdf","2026-02-30--test--"+ID+".pdf","2026-11-02--a--../../x.pdf","2026-11-02--a--"+ID+".html"])
  assert.equal(validAttachmentName(bad),false);
});
test("PDF-only download/ingest magic and bounded bytes",()=>{
 const encoder=new TextEncoder();
 const valid=encoder.encode("%PDF-1.7\n"+("x".repeat(1500))+"\n%%EOF");
 assert.equal(looksLikePdf(valid),true);
 assert.equal(looksLikePdf(encoder.encode("NOTPDF"+"x".repeat(1500)+"%%EOF")),false);
 assert.equal(looksLikePdf(encoder.encode("%PDF-1.7\n"+("x".repeat(1500)))),false);
 assert.equal(looksLikePdf(new Uint8Array(REPORT_ATTACHMENT_MAX_BYTES+1)),false);
});
