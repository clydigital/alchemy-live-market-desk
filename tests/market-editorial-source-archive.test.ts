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
  assert.ok(archive.includes("Date.parse(p.capturedAt)===Date.parse(observedAt)"));
  const claims=readFileSync(new URL("../lib/market-editorial-v1.ts",import.meta.url),"utf8");
  for(const guard of [
    "iso(p.capturedAt,packet.asOf)",
    "p.sourceUrl===original",
    "row.claimText!.includes(p.matchedMetric)",
  ])assert.ok(claims.includes(guard),guard);
});

test("both engine-frozen and fallback-frozen bases attempt bounded source capture",()=>{
  const helperAt=canonical.indexOf("async function tryArchiveOriginalIssuerSourcesForBase");
  const start=canonical.indexOf("export async function persistCanonicalJourneyEditionForResearchRun");
  const done=canonical.indexOf("export async function composeCanonicalDossierEditionForResearchRun");
  assert.ok(helperAt>0 && start>helperAt && done>start);
  const helper=canonical.slice(helperAt,start);
  const base=canonical.slice(start,done);
  assert.match(helper,/await prepareFrozenMarketEditorial/);
  assert.match(helper,/await archiveMissingIssuerPassages\(candidates\)/);
  assert.match(helper,/editionPayload:base\.payload/);
  assert.match(helper,/asOf:base\.published_at/);
  assert.match(helper,/maxArticles:1/);
  assert.match(helper,/Optional base-edition issuer source capture unavailable/);

  const reused=base.indexOf("if (isCanonicalBaseEdition(existing))");
  const earlyCapture=base.indexOf("await tryArchiveOriginalIssuerSourcesForBase(existing)");
  const earlyReturn=base.indexOf("return existing.id");
  const persist=base.indexOf("const { value: canonicalBase } = await persistOrReuseCanonicalArtifact");
  const fallbackCapture=base.indexOf("await tryArchiveOriginalIssuerSourcesForBase(canonicalBase)");
  const fallbackReturn=base.lastIndexOf("return canonicalBase.id");
  assert.ok(reused>=0 && earlyCapture>reused && earlyReturn>earlyCapture);
  assert.ok(persist>earlyReturn && fallbackCapture>persist && fallbackReturn>fallbackCapture);
  assert.doesNotMatch(base,/marketEditorialSectionsV2:/);
  assert.doesNotMatch(base,/runStructuredStage/);
  assert.doesNotMatch(base,/edition_phase: "source_capture"/);
});

test("capture diagnostics expose eligibility, attempted URL count, saved count and reason without new persistence",()=>{
  assert.match(canonical,/event:"editorial_source_capture_base"/);
  assert.match(canonical,/editorial_source_capture_composed/);
  assert.match(canonical,/candidateCount:candidates.length/);
  assert.match(canonical,/candidateCount:sourceCandidates.length/);
  assert.match(canonical,/attempted:capture.attempted,archived:capture.archived/);
  assert.match(canonical,/attempted:archived.attempted,archived:archived.archived/);
  assert.match(canonical,/NO_SOURCE_QUALIFIED_CANDIDATE/);
  assert.match(canonical,/reasons:archived.warnings.slice\(0,2\)/);
  assert.doesNotMatch(canonical,/console\.info\([^;]*editorialSourcePassages/);
  assert.doesNotMatch(canonical,/edition_phase: "source_capture"/);
});
