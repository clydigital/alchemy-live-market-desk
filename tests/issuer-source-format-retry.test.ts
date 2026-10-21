import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const archive=readFileSync(new URL("../lib/market-editorial-source-archive.ts",import.meta.url),"utf8");
const publisher=readFileSync(new URL("../lib/intelligence/canonical-journey-edition.ts",import.meta.url),"utf8");
const source=readFileSync(new URL("../lib/dossier-v2/issuer-source-passages.ts",import.meta.url),"utf8");

test("bounded scheduled retry covers multiple issuers instead of starving a second issuer",()=>{
  assert.match(archive,/const firstPerIssuer=eligible\.filter/);
  assert.match(archive,/selectedIssuers\.add\(row\.issuer\)/);
  assert.match(archive,/const chosen=\[\.\.\.firstPerIssuer,\.\.\.eligible\.filter/);
  assert.match(archive,/\.slice\(0,2\)/);
});
test("private run diagnostics carry only publisher and enumerated reason, no source text",()=>{
  assert.match(archive,/captureVerifiedIssuerPassagesDiagnosed/);
  assert.match(archive,/warnings:outcomes\.filter\(x=>!x\.saved\)\.map\(x=>x\.issuer\+":"\+x\.reason\)/);
  assert.match(publisher,/Optional issuer source capture diagnostics/);
  assert.doesNotMatch(archive,/console\.log\(.+sourceUrl/);
  assert.match(source,/METRIC_IN_TABLE_NOT_VERIFIED/);
  assert.match(source,/redirect:"error"/);
  assert.match(source,/TIMEOUT_MS=5_000/);
});
test("original source paragraph expansion never uses a model or table-to-unit conversion",()=>{
  assert.match(source,/Stitch at most two adjoining ORIGINAL/);
  assert.match(source,/paragraphs\[i-1\]\+" "\+anchored/);
  assert.match(source,/anchored\+" "\+paragraphs\[i\+1\]/);
  assert.match(source,/Financial tables are intentionally excluded/);
  assert.doesNotMatch(source,/runStructuredStage|openai|gpt/);
  assert.doesNotMatch(source,/structured_payload\.claim_text\s*=/);
});
