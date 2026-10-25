import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {
 parseExternalResearch,chatResearchTransferPrompt,sourceLinksFromResearch,
} from "../lib/editorial-external-research.ts";
const SEC="https://www.sec.gov/Archives/edgar/data/1326801/000132680126000999/meta-fy26.html";
const FED="https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm";
test("plain sourced ChatGPT Markdown is imported as unverified COTD without server access",()=>{
 const result=parseExternalResearch(
  "# Oil diverges from long-end rates\n\nUNKNOWN reaction. "+
  "Original source: "+FED+"\n\nAlternative: positioning.", "COTD");
 assert.equal(result.ok,true);
 if(!result.ok)return;
 assert.equal(result.research.kind,"COTD");
 assert.equal(result.research.title,"Oil diverges from long-end rates");
 assert.ok(result.research.body.includes("Alternative: positioning."));
 assert.ok(result.research.sources.includes(FED));
 assert.equal(result.research.status,"IMPORTED_UNVERIFIED");
 assert.match(result.research.missingProof,/NOT INDEPENDENTLY VERIFIED/);
 assert.ok(result.warnings.some(w=>/unverified/i.test(w)));
});
test("structured OB packet maps directly to editor fields, never accepts external verified status",()=>{
 const input=JSON.stringify({
  kind:"OB",title:"Meta cash investment and the quarterised FCF gap",meta:"Cash PP&E disclosure.",
  body:"Issuer-reported FCF and simple FCF require different definitions.",
  hook:"Capital investment versus CFO",catalysts:"2026-10-22 SEC filing",
  observed:"UNKNOWN event reaction",priceReaction:"fabricated discard",
  mechanism:"Capex may pressure cash flow",countercase:"Financing lease distinction",
  nextTrigger:"Verify issuer reconciliation",invalidation:"Stronger free cash flow",
  chartGuidance:["SEC FCF definition","Price chart uninspected"],
  sourceUrls:[SEC,SEC,"http://localhost/private","https://user:pass@evil.example/a"],
  status:"VERIFIED",canPublish:true,
 });
 const result=parseExternalResearch(input,"COTD");
 assert.equal(result.ok,true);
 if(!result.ok)return;
 assert.equal(result.research.status,"IMPORTED_UNVERIFIED");
 assert.equal(result.research.kind,"OB");
 assert.equal(result.research.observed,"UNKNOWN event reaction");
 assert.equal(result.research.alternative,"Financing lease distinction");
 assert.equal(result.research.confirmation,"Verify issuer reconciliation");
 assert.equal(result.research.chart1,"SEC FCF definition");
 assert.equal(result.research.chart2,"Price chart uninspected");
 assert.equal(result.research.sourceCount,1);
 assert.equal(result.research.sources,SEC);
 assert.doesNotMatch(result.research.sources,/evil|localhost/);
 assert.ok(result.research.missingProof.includes("NOT INDEPENDENTLY VERIFIED"));
});
test("ChatGPT fenced JSON research is imported as structured data, not a raw code snippet",()=>{
 const markdown="```json\n"+JSON.stringify({
  kind:"COTD",title:"Oil at a hypothetical EMA decision",
  hook:"Chart structure needs independent review",body:"Research draft with uncertainty.",
  sourceUrls:[FED],
 })+"\n```";
 const result=parseExternalResearch(markdown,"OB");
 assert.equal(result.ok,true);
 if(!result.ok)return;
 assert.equal(result.research.kind,"COTD");
 assert.equal(result.research.title,"Oil at a hypothetical EMA decision");
 assert.equal(result.research.sources,FED);
});
test("invalid/missing JSON and oversized notes fail without replacing browser drafts",()=>{
 assert.equal(parseExternalResearch("", "OB").ok,false);
 assert.equal(parseExternalResearch("{oops","OB").ok,false);
 assert.equal(parseExternalResearch("{}","OB").ok,false);
 assert.equal(parseExternalResearch("x".repeat(33_000),"COTD").ok,false);
 assert.equal(parseExternalResearch(JSON.stringify({kind:"OB",title:"Just a headline"}),"OB").ok,false);
});
test("sources are bounded, deduped, HTTPS only; unusable source retains explicit gap",()=>{
 const withLinks=sourceLinksFromResearch(
  [FED,FED,"https://user:secret@fed.example/path","javascript:alert(1)","http://www.sec.gov/"],
  SEC+" and "+FED+".");
 assert.deepEqual(withLinks,[FED,SEC]);
 const noSources=parseExternalResearch("# Topic\n\nAn unverified candidate; reaction UNKNOWN.", "OB");
 assert.equal(noSources.ok,true);
 if(!noSources.ok)return;
 assert.equal(noSources.research.sourceCount,0);
 assert.match(noSources.warnings.join(" "),/No valid original HTTPS source/);
});
test("research prompt demands original sources and UNKNOWN rather than false event-tick precision",()=>{
 for(const mode of ["OB","COTD"] as const){
  const prompt=chatResearchTransferPrompt(mode);
  assert.match(prompt,/original primary sources/);
  assert.match(prompt,/5m\/30m\/4h event-window reactions UNKNOWN/);
  assert.match(prompt,/JSON object/);
  assert.match(prompt,/sourceUrls/);
  assert.match(prompt,/unverified/i);
 }
});
test("public lab imports real research *locally*, never opens private owner model or canonical API",()=>{
 const editor=readFileSync(new URL("../components/blue-desk/EditorialWorkbench.tsx",import.meta.url),"utf8");
 const lab=readFileSync(new URL("../app/blue-desk/editorial-lab/page.tsx",import.meta.url),"utf8");
 const global=readFileSync(new URL("../app/globals.css",import.meta.url),"utf8");
 assert.match(editor,/data-external-research-transfer="local-only"/);
 assert.match(editor,/parseExternalResearch\(externalResearch,externalKind\)/);
 assert.match(editor,/setDraft\(\{\.\.\.EMPTY,kind:entry\.kind/);
 assert.match(editor,/externalResearch/);
 assert.match(editor,/previewMode\?\<section/);
 assert.match(editor,/Print unverified draft \/ Save as PDF/);
 assert.match(editor,/window\.print\(\)/);
 assert.match(global,/body:has\(\[data-print-local-draft\]\)/);
 assert.match(editor,/WORKING DRAFT · EXTERNAL RESEARCH UNVERIFIED/);
 assert.match(lab,/No imported notes are/);
 assert.doesNotMatch(lab,/getMarketMonitor\(|createSupabaseAdminClient|fetch\(|GoogleGenAI/);
 assert.ok(editor.indexOf("if(previewMode){")<editor.indexOf('fetch("/api/owner/editorial-generate"'));
 assert.equal((editor.match(/fetch\("\/api\/owner\/editorial-generate"/g)||[]).length,1);
});
