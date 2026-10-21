import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { augmentDossierWithEditorial } from "../lib/market-editorial-combined.ts";
import type { EditorialCandidate } from "../lib/market-editorial-v1.ts";

function candidate(fingerprint="a".repeat(32)): EditorialCandidate {
  return {
    fingerprint,
    facts:[{
      factId:"c3776638-d2cb-40e1-acf7-36850d992edc",
      text:"TSMC reports current quarter earnings from an original release",
      sourceUrl:"https://pr.tsmc.com/english/news/3346",
      sourceName:"TSMC",availableAt:"2026-10-20T09:00:00Z",
    }],
    packet: {
      contractVersion:"market-impact-packet/1",kind:"STORY",
      identity:{storyId:"6e2c8a8c-fdc7-45eb-bec6-b685b0311f3e",
        motionId:null,storyThesisVersionId:"85d6149f-50b2-4bc9-a07f-7de152675541",
        storySnapshotId:"2e99dc08-f707-4ec4-936c-80c6b4aa5953",
        lineage:"EXACT_EDITION_MANIFEST"},
      evidenceCandidateIds:[],asOf:"2026-10-20T16:19:12Z",
      sourceVersionEffectiveAt:null,attentionAssessedAt:null,materialChangeAt:null,
      headline:"AI infrastructure demand is still under scrutiny",
      development:{text:null,basis:"FROZEN_DOSSIER_CONTEXT",evidenceIds:[],sourceUrl:null},
      background:[],mechanism:{text:null,evidenceIds:[],evidenceState:"UNAVAILABLE"},
      assetReadThroughs:[],observedReaction:null,reactionCandidate:null,countercase:null,
      nextTest:null,sourceUrls:[],missing:[],
    },
  };
}
const dossierRequest = {
  stageKey:"dossier_storyline_composer",instructions:"Retain canonical Story boundaries.",
  input:{marketTape:null,candidates:[{storyId:"6e2c8a8c-fdc7-45eb-bec6-b685b0311f3e"}]},
  schema:{type:"object",additionalProperties:false,required:["opening","storylines","lessonOrder"],
    properties:{opening:{type:"object"},storylines:{type:"array"},lessonOrder:{type:"array"}}},
  modelKind:"complex" as const,maxOutputTokens:5000,maxAttempts:2,
};
const editorialSchema = {
  type:"object",required:["articles"],properties:{
    articles:{type:"array",items:{type:"object",required:["fingerprint","paragraphs"]}},
  },
};
test("combined one-call stage preserves Dossier fields and adds only editorial array",()=>{
  const request=augmentDossierWithEditorial(dossierRequest,{
    editorialSchema,editorialInstructions:"Only cite the supplied first-tier facts.",
    candidates:[candidate()],candidateInput:c=>({fingerprint:c.fingerprint,verifiedFacts:c.facts}),
  });
  assert.equal(request.stageKey,"dossier_storyline_composer");
  assert.equal(request.modelKind,"complex");
  assert.equal(request.maxOutputTokens,6500);
  assert.equal(request.maxAttempts,1);
  assert.deepEqual(request.schema.required,["opening","storylines","lessonOrder","articles"]);
  assert.deepEqual(Object.keys(request.schema.properties),["opening","storylines","lessonOrder","articles"]);
  assert.deepEqual((request.input as Record<string,unknown>).candidates,dossierRequest.input.candidates);
  assert.deepEqual((request.input as {editorialCandidates:unknown[]}).editorialCandidates,
    [{fingerprint:"a".repeat(32),verifiedFacts:candidate().facts}]);
  assert.match(request.instructions,/SECONDARY EDITORIAL OUTPUT/);
  assert.match(request.instructions,/Return the regular Dossier fields unchanged in meaning/);
  assert.match(request.instructions,/articles to an empty array/);
  assert.deepEqual(dossierRequest.schema.required,["opening","storylines","lessonOrder"],
    "Original Dossier schema must remain unmodified");
});
test("combined output cannot be used for a second or different model stage",()=>{
  assert.throws(()=>augmentDossierWithEditorial({...dossierRequest,stageKey:"market_editorial_composer"},{
    editorialSchema,editorialInstructions:"",candidates:[candidate()],candidateInput:()=>({}),
  }),/existing Dossier composer stage/);
  for(const candidates of [[],[candidate(),candidate("b".repeat(32)),candidate("c".repeat(32))]]) {
    assert.throws(()=>augmentDossierWithEditorial(dossierRequest,{
      editorialSchema,editorialInstructions:"",candidates,candidateInput:()=>({}),
    }),/schema or article budget/);
  }
});
test("bad schema and missing Dossier input fail before provider invocation",()=>{
  assert.throws(()=>augmentDossierWithEditorial({...dossierRequest,input:null},{
    editorialSchema,editorialInstructions:"",candidates:[candidate()],candidateInput:()=>({}),
  }),/not a JSON object/);
  assert.throws(()=>augmentDossierWithEditorial(dossierRequest,{
    editorialSchema:{properties:{}},editorialInstructions:"",candidates:[candidate()],candidateInput:()=>({}),
  }),/schema or article budget/);
});
test("edition handoff injects the combined runner only when source-qualified",()=>{
  const edition=readFileSync(new URL("../lib/intelligence/canonical-journey-edition.ts",import.meta.url),"utf8");
  const prep=edition.indexOf("combinedCandidates = await prepareFrozenMarketEditorial");
  const wrap=edition.indexOf("const combinedRunner:");
  const model=edition.indexOf("await runStructuredStage<T & ModelEditorialOutput>(augmented)");
  const compose=edition.indexOf("const composed = await composePersistedDossierStorylines");
  assert.ok(prep>0&&wrap>prep&&model>wrap&&compose>model);
  assert.match(edition,/maxArticles: 1,/);
  assert.match(edition,/combinedArticles = validateMarketEditorialOutput\(response\.data, combinedCandidates\)/);
  assert.match(edition,/\.{3}\(combinedRunner \? \{ modelRunner: combinedRunner \} : \{\}\)/);
  assert.match(edition,/!dossierHasModelCandidates && editorialStage\.permitted/);
  assert.doesNotMatch(edition,/edition_phase: "editorial"/);
});
test("editorial source admission remains a read-only preliminary step",()=>{
  const runtime=readFileSync(new URL("../lib/market-editorial-runtime.ts",import.meta.url),"utf8");
  assert.match(runtime,/export async function prepareFrozenMarketEditorial/);
  assert.match(runtime,/export function editorialCandidateModelInput/);
  assert.match(runtime,/return candidates;/);
  assert.match(runtime,/const candidates = await prepareFrozenMarketEditorial\(input\);/);
});
