import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  verifiedCanonicalMoveSeries, requiresExactMoveSeriesProof,
  buildMoveExactProof, type CanonicalMoveRow,
} from "../lib/research-gap-exact-move-proof.ts";

const evaluatedAt=new Date("2026-10-10T22:00:00Z");
const valid:CanonicalMoveRow={
  id:"69dfaa87-cab9-4a5b-be09-fe78c0c0d198",
  normalised_observation_id:"c8d88e70-bc98-420e-b368-69d8b1a93344",
  external_evidence_id:"ice-move:2026-10-08:20s",
  observed_value:108.2,
  measurement_unit:"index_points",
  event_at:"2026-10-08T23:59:59.999Z",
  available_at:"2026-10-09T14:30:00Z",
  affected_assets:["MOVE","UST"],
  provenance_urls:["https://indices.ice.com/index/move"],
  structured_payload:{metric:"ICE_MOVE",windowSessions:20,methodologyVersion:"ice-move-series-v1"},
};
test("ICE issuer-origin canonical 20s numeric data with UUID and release clock can prove a MOVE series",()=>{
  assert.equal(verifiedCanonicalMoveSeries(valid,evaluatedAt),true);
  assert.equal(buildMoveExactProof([valid.id],true)?.proofState,"VERIFIED_NUMERIC_SERIES");
});
test("authentic vendor documentation or misleading numeric reference is not observed MOVE index points",()=>{
  const mutate=[
    {id:"gap-web:630dabb1d9ffd78fcd421717"},
    {measurement_unit:"basis_points"},
    {observed_value:null},
    {observed_value:"NaN"},
    {event_at:"2026-10-12T00:00:00Z"},
    {available_at:"2026-10-12T00:00:00Z"},
    {provenance_urls:["https://barchart.com/MOVE"]},
    {structured_payload:{metric:"ICE_MOVE",windowSessions:1}},
    {structured_payload:{metric:"VIX",windowSessions:20}},
    {normalised_observation_id:null},
    {affected_assets:["VIX"]},
  ];
  for(const update of mutate){
    assert.equal(verifiedCanonicalMoveSeries({...valid,...update} as CanonicalMoveRow,evaluatedAt),false,JSON.stringify(update));
  }
  assert.equal(verifiedCanonicalMoveSeries({...valid,event_at:"2026-09-01T23:59:59Z"},evaluatedAt),false);
});
test("source-access-only MOVE question does not receive numeric-series proof gate",()=>{
  assert.equal(requiresExactMoveSeriesProof("How do I license ICE MOVE access?",["Find the ICE license"] ),false);
  assert.equal(requiresExactMoveSeriesProof("Canonical MOVE / Treasury-volatility time series is absent from packet",["Canonical MOVE series"]),true);
  assert.equal(requiresExactMoveSeriesProof("HY credit spread widens 50bp",["ICE MOVE vendor access"]),false);
  assert.equal(buildMoveExactProof([],true)?.proofState,"UNRESOLVED");
  assert.equal(buildMoveExactProof([],false),null);
});
test("exact proof validates the canonical row server-side before passing approved UUIDs to stop gate",()=>{
  const route=readFileSync(new URL("../app/api/research-gap/execution/route.ts",import.meta.url),"utf8");
  const evaluator=readFileSync(new URL("../lib/research-gap-plan.ts",import.meta.url),"utf8");
  assert.match(route,/verifiedCanonicalMoveSeries\(row as CanonicalMoveRow,new Date\(\)\)/);
  assert.match(route,/\.from\("intelligence_evidence"\)/);
  assert.match(route,/verifiedCanonicalObservationIds/);
  assert.match(evaluator,/serverVerified\.has\(item\.evidenceId\)/);
  assert.doesNotMatch(route,/\.from\("story_thesis_versions"\)|\.from\("stories"\)/);
});
