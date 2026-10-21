import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const archive=readFileSync(new URL("../lib/market-editorial-source-archive.ts",import.meta.url),"utf8");
const canonical=readFileSync(new URL("../lib/intelligence/canonical-journey-edition.ts",import.meta.url),"utf8");
const runtime=readFileSync(new URL("../lib/market-editorial-runtime.ts",import.meta.url),"utf8");

test("automatic publisher archives are linked to the existing Dossier research cadence",()=>{
  assert.match(canonical,/await archiveMissingIssuerPassages\(sourceCandidates\)/);
  const archiveAt=canonical.indexOf("await archiveMissingIssuerPassages(sourceCandidates)");
  const composerAt=canonical.indexOf("const composed = await composePersistedDossierStorylines");
  assert.ok(archiveAt>0 && composerAt>archiveAt);
  assert.match(canonical,/const archived=await archiveMissingIssuerPassages/);
  assert.match(canonical,/Automatic original-source capture unavailable; canonical publication continues/);
  assert.match(canonical,/edition_phase: "composed"/);
  assert.doesNotMatch(canonical,/edition_phase: "source_capture"/);
});

test("first-observed original-source time is a separate bounded, forward-only archive",()=>{
  assert.match(archive,/const PROVIDER="issuer_editorial_source_snapshot_v1"/);
  assert.match(archive,/captureVerifiedIssuerPassages/);
  assert.match(archive,/\\.slice\(0,2\)/);
  assert.match(archive,/observed_at:capturedAt,fetched_at:capturedAt/);
  assert.match(archive,/published_at:null/);
  assert.match(archive,/raw_source_records/);
  assert.match(archive,/\\.eq\("provider",PROVIDER\)/);
  assert.match(archive,/error\\.code==="23505"/);
  assert.match(archive,/row\\.structured_payload\\?\\.evidenceNature!=="verified_issuer_result"/);
  assert.doesNotMatch(archive,/update\(["']intelligence_evidence/);
  assert.doesNotMatch(archive,/from\(["']story_thesis_versions["']\)/);
});

test("archived source passages are read for a NEW edition with per-claim clock checks",()=>{
  assert.match(runtime,/await loadArchivedIssuerPassages/);
  assert.match(runtime,/\\.catch\(\(\)=>new Map/);
  assert.match(runtime,/\\.\\.\\.\\(archival\\.get\(row\\.id\\.toLowerCase\(\)\)\\|\\|\\[\\]\\)/);
  assert.match(archive,/Date\\.parse\(p\\.capturedAt\)===Date\\.parse\(raw\\.observed_at\)/);
  const sourceGate=readFileSync(new URL("../lib/market-editorial-v1.ts",import.meta.url),"utf8");
  assert.match(sourceGate,/iso\(p\\.capturedAt,packet\\.asOf\)/);
  assert.match(sourceGate,/p\\.sourceUrl===original/);
  assert.match(sourceGate,/row\\.claimText!\\.includes\(p\\.matchedMetric\)/);
});
