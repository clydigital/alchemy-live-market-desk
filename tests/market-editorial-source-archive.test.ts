import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const archive=readFileSync(new URL("../lib/market-editorial-source-archive.ts",import.meta.url),"utf8");
const canonical=readFileSync(new URL("../lib/intelligence/canonical-journey-edition.ts",import.meta.url),"utf8");
const runtime=readFileSync(new URL("../lib/market-editorial-runtime.ts",import.meta.url),"utf8");

test("automatic archival reuses existing Dossier cadence, not another composition phase",()=>{
  const archiveAt=canonical.indexOf("await archiveMissingIssuerPassages(sourceCandidates)");
  const composeAt=canonical.indexOf("const composed = await composePersistedDossierStorylines");
  assert.ok(archiveAt>0 && composeAt>archiveAt);
  assert.ok(canonical.includes("Automatic original-source capture unavailable; canonical publication continues"));
  assert.ok(canonical.includes('edition_phase: "composed"'));
  assert.ok(!canonical.includes('edition_phase: "source_capture"'));
});
test("first observed time and issuer original source use an idempotent archive",()=>{
  for(const token of [
    'const PROVIDER="issuer_editorial_source_snapshot_v1"',
    "captureVerifiedIssuerPassages",
    ".slice(0,2)",
    "observed_at:capturedAt,fetched_at:capturedAt",
    "published_at:null",
    "raw_source_records",
    '.eq("provider",PROVIDER)',
    'error.code==="23505"',
    'row.structured_payload?.evidenceNature!=="verified_issuer_result"',
  ])assert.ok(archive.includes(token),token);
  assert.ok(!archive.includes('.from("story_thesis_versions")'));
});
test("a new immutable edition sees only earlier archive material tied to its exact claim",()=>{
  assert.ok(runtime.includes("await loadArchivedIssuerPassages"));
  assert.ok(runtime.includes(".catch(()=>new Map"));
  assert.ok(runtime.includes("...(archival.get(row.id.toLowerCase())||[])"));
  assert.ok(archive.includes("Date.parse(p.capturedAt)===Date.parse(raw.observed_at)"));
  const claims=readFileSync(new URL("../lib/market-editorial-v1.ts",import.meta.url),"utf8");
  for(const guard of [
    "iso(p.capturedAt,packet.asOf)",
    "p.sourceUrl===original",
    "row.claimText!.includes(p.matchedMetric)",
  ])assert.ok(claims.includes(guard),guard);
});
