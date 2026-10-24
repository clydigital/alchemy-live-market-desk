import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { blueDeskHostAccess } from "../lib/blue-desk-host.ts";
import {
  BLUEBELLY_CANONICAL_STORY_VERSION_V1,
  parseExactCanonicalStoryVersionSelection,
  projectBluebellyCanonicalStoryVersion,
  referencedEvidenceIds,
} from "../lib/bluebelly-canonical-story-version.ts";

const storyId = "6e2c8a8c-fdc7-45eb-bec6-b685b0311f3e";
const versionId = "bf166917-8d96-4c21-af8d-3f9e74df44bc";
const eventId = "0c643e07-0d04-4081-973e-a582268fe122";
const evidenceId = "d731a5a6-9845-4d4c-9153-11c0446cbf23";
const asOf = "2026-10-23T14:40:52.520Z";
const version = {
  id: versionId, story_id: storyId, event_id: eventId,
  version_number: 14, effective_at: asOf,
  title: "AI orders are real but near-term cash conversion uncertain",
  market_question: "Does supplier backlog translate to cash generation?",
  thesis: "Issuer results imply real AI demand, but financing and operating-cash conversion remain open questions.",
  status: "monitor", confidence: 73,
  strongest_contradiction: "Backlog still translates into substantial upstream revenue.",
  confirmation_trigger: "Independently measured cash-flow improvements.",
  invalidation_trigger: "Sustained deterioration in verified operating cash flow.",
  next_catalyst: "Next issuer filing.",
  snapshot: { diagnostics: { private: true }, reasoning: {
    contractVersion: "canonical-story-reasoning/v1",
    claims: [
      { id: "c1", text: "Meta SEC XBRL claim", evidenceIds: [evidenceId, "not-a-uuid"] },
      { id: "c2", text: "Second view", evidenceIds: [evidenceId] },
    ],
  } },
};
const evidence = {
  id: evidenceId,
  evidence_class: "regulatory_filing",
  claim_text: "The filing reports SEC XBRL cash-flow observations.",
  available_at: "2026-10-23T00:00:00.000Z",
  created_at: "2026-10-23T01:44:49.940Z",
  source: {
    source_name: "U.S. Securities and Exchange Commission",
    source_url: "https://data.sec.gov/api/xbrl/companyfacts/CIK0001326801.json",
    source_tier: 1,
  },
};

test("exact Story/version UUID selection rejects ambiguity", () => {
  assert.deepEqual(parseExactCanonicalStoryVersionSelection(storyId,versionId),
    {storyId,versionId});
  assert.equal(parseExactCanonicalStoryVersionSelection(storyId,null),null);
  assert.equal(parseExactCanonicalStoryVersionSelection(null,versionId),null);
  assert.equal(parseExactCanonicalStoryVersionSelection("AI Story",versionId),null);
  assert.equal(parseExactCanonicalStoryVersionSelection(storyId,versionId + "suffix"),null);
});

test("version reasoning references only a bounded, deduplicated canonical evidence set", () => {
  assert.deepEqual(referencedEvidenceIds(version),[evidenceId]);
  assert.deepEqual(referencedEvidenceIds({...version,snapshot:{reasoning:{
    contractVersion:"unknown",claims:[{evidenceIds:[evidenceId]}],
  }}}),[]);
});

test("canonical Story version returns exact immutable identity and independently checked SEC facts", () => {
  const result=projectBluebellyCanonicalStoryVersion(version,[evidence],{storyId,versionId});
  assert.ok(result);
  assert.equal(result.contractVersion,BLUEBELLY_CANONICAL_STORY_VERSION_V1);
  assert.equal(result.recordType,"EXACT_CANONICAL_STORY_THESIS_VERSION");
  assert.equal(result.versionId,versionId);
  assert.equal(result.storyId,storyId);
  assert.equal(result.versionNumber,14);
  assert.equal(result.eventId,eventId);
  assert.equal(result.effectiveAt,asOf);
  assert.equal(result.evidence.referencedCount,1);
  assert.equal(result.evidence.admittedSourceFactCount,1);
  assert.equal(result.evidence.state,"SOURCE_LINKED");
  assert.equal(result.evidence.facts[0].evidenceId,evidenceId);
  assert.equal(result.verificationBoundary.dossierDecision,"NOT_INFERRED");
  assert.equal(result.verificationBoundary.marketReaction,"NOT_VERIFIED");
  assert.equal(result.verificationBoundary.causalAttribution,"NOT_VERIFIED");
  const json=JSON.stringify(result);
  for(const privateField of ["snapshot","reasoning","raw_payload","diagnostics",
    "canonicalMutationKey","researchRunId","service_role","structured_payload"]){
    assert.equal(json.includes('"' + privateField + '"'),false,privateField);
  }
  assert.deepEqual(Object.keys(result).sort(),[
    "contractVersion","recordType","storyId","versionId","eventId",
    "versionNumber","effectiveAt","title","marketQuestion","thesis",
    "status","confidence","strongestContradiction","confirmationTrigger",
    "invalidationTrigger","nextCatalyst","thesisTruncated","evidence",
    "verificationBoundary",
  ].sort());
});

test("future, wrong-source, lower-tier and unrelated evidence cannot become proof", () => {
  const expected={storyId,versionId};
  const checks=[
    {...evidence,id:"11111111-1111-4111-8111-111111111111"},
    {...evidence,created_at:"2026-10-24T00:00:00.000Z"},
    {...evidence,available_at:"2026-10-24T00:00:00.000Z"},
    {...evidence,evidence_class:"creator_transcript"},
    {...evidence,source:{...evidence.source,source_tier:4}},
    {...evidence,source:{...evidence.source,source_url:"https://sec.gov/"}},
    {...evidence,source:{...evidence.source,source_url:"javascript:alert(1)"}},
  ];
  for (const item of checks){
    const dto=projectBluebellyCanonicalStoryVersion(version,[item],expected);
    assert.ok(dto);
    assert.equal(dto.evidence.state,"SOURCE_GAP");
    assert.equal(dto.evidence.facts.length,0);
    assert.equal(dto.evidence.referencedCount,1);
  }
  const noRows=projectBluebellyCanonicalStoryVersion(version,[],expected);
  assert.ok(noRows);
  assert.equal(noRows.evidence.state,"SOURCE_GAP");
  assert.equal(noRows.verificationBoundary.dossierDecision,"NOT_INFERRED");
});

test("mismatched exact version identity or malformed version fails closed", () => {
  const expected={storyId,versionId};
  assert.equal(projectBluebellyCanonicalStoryVersion({...version,story_id:"11111111-1111-4111-8111-111111111111"},[evidence],expected),null);
  assert.equal(projectBluebellyCanonicalStoryVersion({...version,id:"11111111-1111-4111-8111-111111111111"},[evidence],expected),null);
  assert.equal(projectBluebellyCanonicalStoryVersion({...version,effective_at:"invalid"},[evidence],expected),null);
  assert.equal(projectBluebellyCanonicalStoryVersion({...version,confidence:200},[evidence],expected),null);
  assert.equal(projectBluebellyCanonicalStoryVersion({...version,version_number:0},[evidence],expected),null);
});

test("API cannot be called anonymously on Bluebelly or bypass the owner allowlist",()=>{
  const path="/api/owner/bluebelly/v1/story-version";
  assert.equal(blueDeskHostAccess(path,"bluebelly-desk.vercel.app"),"blocked");
  assert.equal(blueDeskHostAccess(path,"alchemy-live-market-desk.vercel.app"),"private");
  const route=readFileSync(new URL("../app/api/owner/bluebelly/v1/story-version/route.ts",import.meta.url),"utf8");
  assert.match(route,/session\.auth\.getUser\(\)/);
  assert.match(route,/app_access_allowlist/);
  assert.match(route,/getAll\("story"\)/);
  assert.match(route,/getAll\("version"\)/);
  assert.match(route,/from\("story_thesis_versions"\)/);
  assert.match(route,/from\("intelligence_evidence"\)/);
  assert.match(route,/private, no-store/);
  assert.doesNotMatch(route,/Access-Control-Allow-Origin|getHybridPresenterEditionCandidates|getLiveDeskHomepageDailyBrief|NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
});
