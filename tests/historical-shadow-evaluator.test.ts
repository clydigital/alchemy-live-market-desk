import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { evaluateHistoricalShadows, historicalShadowMarkdown } from '../lib/intelligence/historical-shadow-evaluator.ts';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/historical-shadow-run.json',import.meta.url),'utf8'));
const fresh = () => structuredClone(fixture);
const div = (v: any) => evaluateHistoricalShadows(v).rows[1];
const mb = (v: any) => evaluateHistoricalShadows(v).rows[0];

test('production-shaped frozen rows reconstruct exact anchored digest and true skip',()=>{
  const f=fresh(), before=JSON.stringify(f), r=evaluateHistoricalShadows(f);
  assert.equal(r.rows[0].classification,'true_run');
  assert.equal(r.rows[1].classification,'true_skip');
  assert.equal(r.rows[1].digest?.anchorEvidenceCount,1);
  assert.equal(r.rows[1].candidateEvidenceCount,1);
  assert.equal(r.aggregate.estimatedAvoidableModelStageCalls,1);
  assert.equal(JSON.stringify(f),before);
});
test('material divergence output exposes false skip',()=>{
  const f=fresh(); f.stage_runs[1].output_payload.divergences=[{marketBeliefId:'b1',observedChange:'Yield rises',expectedChange:null,magnitude:50,persistenceScore:40,decisiveEvidenceIds:['e-1']}];
  assert.equal(div(f).classification,'false_skip');
  assert.equal(evaluateHistoricalShadows(f).byStage.divergence.falseSkipRatePct,100);
  assert.equal(evaluateHistoricalShadows(f).aggregate.estimatedAvoidableModelStageCalls,0);
});
test('context creates a false run with weighted evidence reduction',()=>{
  const f=fresh(); const e=structuredClone(f.engine_runs[0].metadata.frozenInputs.evidence[0]);
  e.id='e-2'; e.claim_text='Corporate earnings exceed analyst forecasts'; e.structured_payload.itemKey='earnings:2';
  f.engine_runs[0].metadata.frozenInputs.evidence.push(e); f.stage_runs.forEach((s:any)=>s.input_refs.evidenceCount=2);
  assert.equal(div(f).classification,'false_run'); assert.equal(div(f).candidateEvidenceCount,2);
});
test('unchanged assessments are output but not material',()=>{
  const f=fresh(); f.stage_runs[0].input_refs={evidenceCount:0,storyReviewTargetCount:0};
  f.stage_runs[0].output_payload={beliefs:[],recruitmentClusters:[],storyAssessments:[{storyId:'s1',disposition:'unchanged'}]};
  assert.equal(mb(f).classification,'true_skip'); assert.equal(mb(f).actualOutputCount,1);
});
test('recruited clusters and material assessments each expose false skips',()=>{
  for(const kind of ['cluster','assessment']) {const f=fresh(); f.stage_runs[0].input_refs={evidenceCount:0,storyReviewTargetCount:0};
    f.stage_runs[0].output_payload.beliefs=[];
    if(kind==='assessment'){f.stage_runs[0].output_payload.recruitmentClusters=[];f.stage_runs[0].output_payload.storyAssessments=[{storyId:'s1',disposition:'reframed'}];}
    assert.equal(mb(f).classification,'false_skip');}
});
test('Story review targets retain would_run even with zero fresh candidates',()=>{
  const f=fresh(); f.stage_runs[0].input_refs={evidenceCount:0,storyReviewTargetCount:1};
  assert.equal(mb(f).reason,'story_review_targets_present');
});
test('missing and malformed counts never become zero-work decisions',()=>{
  for(const value of [undefined,null,-1,'0',0.5]){const f=fresh(); f.stage_runs[0].input_refs.evidenceCount=value;
    assert.equal(mb(f).classification,'unevaluable'); assert.equal(mb(f).decision,null);}
});
test('missing frozen state and mismatched packet counts fail closed',()=>{
  const f=fresh(); delete f.engine_runs[0].metadata.frozenInputs.evidence; assert.equal(div(f).reason,'missing_frozen_evidence');
  const g=fresh(); g.stage_runs[1].input_refs.evidenceCount=99; assert.equal(div(g).reason,'divergence_evidence_count_mismatch');
});
test('null frozen structured payload matches production empty-object normalisation',()=>{
  const nullPayload=fresh();nullPayload.engine_runs[0].metadata.frozenInputs.evidence[0].structured_payload=null;
  const emptyObject=fresh();emptyObject.engine_runs[0].metadata.frozenInputs.evidence[0].structured_payload={};
  assert.deepEqual(div(nullPayload),div(emptyObject));
  assert.equal(div(nullPayload).status,'evaluated');
  assert.equal(nullPayload.engine_runs[0].metadata.frozenInputs.evidence[0].structured_payload,null);
});
test('malformed frozen structured payload remains unevaluable',()=>{
  for(const value of [[],42,'invalid']){const f=fresh();f.engine_runs[0].metadata.frozenInputs.evidence[0].structured_payload=value;
    assert.equal(div(f).reason,'missing_frozen_structured_payload');}
});
test('malformed output is not silently observed as empty',()=>{
  const f=fresh(); f.stage_runs[1].output_payload={}; assert.equal(div(f).status,'unevaluable');
  const g=fresh(); delete g.stage_runs[0].output_payload.storyAssessments; assert.equal(mb(g).status,'unevaluable');
});
test('latest completed attempt wins independently of export ordering; failed attempts do not count',()=>{
  const f=fresh(); const newer=structuredClone(f.stage_runs[1]); newer.id='div-2'; newer.completed_at='2026-09-10T00:05:00Z'; newer.output_payload={};
  f.stage_runs.unshift(newer); assert.equal(div(f).checkpointId,'div-2'); assert.equal(div(f).status,'unevaluable');
  newer.status='failed'; assert.equal(div(f).checkpointId,'div-1');
});
test('ambiguous attempt timestamps and upserts fail closed',()=>{
  const f=fresh();const extra=structuredClone(f.stage_runs[1]);extra.id='div-2';f.stage_runs.push(extra);assert.equal(div(f).reason,'ambiguous_completed_attempts');
  const g=fresh();g.stage_runs[0].output_payload.beliefs.push(structuredClone(g.stage_runs[0].output_payload.beliefs[0]));assert.equal(div(g).reason,'ambiguous_belief_upsert');
});
test('unrecruited or unknown anchors cannot fabricate a successful replay',()=>{
  const f=fresh();f.stage_runs[0].output_payload.recruitmentClusters[0].verdict='context';assert.equal(div(f).status,'unevaluable');
  const g=fresh();g.stage_runs[0].output_payload.beliefs[0].evidenceIds=['missing'];assert.equal(div(g).status,'unevaluable');
});
test('missing stages and provider IDs do not create avoidable calls',()=>{
  const f=fresh(); f.stage_runs[1].provider_request_id=null;assert.equal(evaluateHistoricalShadows(f).aggregate.estimatedAvoidableModelStageCalls,0);
  f.stage_runs.pop();assert.equal(div(f).status,'unevaluable');
});
test('empty cohorts use null denominators; incomplete runs excluded; duplicate exports rejected',()=>{
  const r=evaluateHistoricalShadows({engine_runs:[],stage_runs:[]});assert.equal(r.aggregate.falseSkipRatePct,null);
  const f=fresh();f.engine_runs[0].status='started';assert.equal(evaluateHistoricalShadows(f).rows.length,0);
  const g=fresh();g.engine_runs.push(g.engine_runs[0]);assert.throws(()=>evaluateHistoricalShadows(g),/duplicate_engine_runs/);
});
test('Markdown escapes table separators and reports limitations',()=>{
  const f=fresh();f.engine_runs[0].id='run|1';const md=historicalShadowMarkdown(evaluateHistoricalShadows(f));
  assert.ok(md.includes('run\\|1'));assert.ok(md.includes('False-skip denominator'));assert.ok(md.includes('Full-input outputs cannot prove'));
});

test('weighted digest reduction is computed from total evidence and missing fields fail closed',()=>{
  const f=fresh(); const e=structuredClone(f.engine_runs[0].metadata.frozenInputs.evidence[0]);
  e.id='unrelated';e.claim_text='Agricultural rainfall forecast shifts harvest expectations';e.affected_assets=['CORN'];e.affected_topics=['weather'];e.structured_payload.itemKey='weather:1';
  f.engine_runs[0].metadata.frozenInputs.evidence.push(e);f.stage_runs.forEach((s:any)=>s.input_refs.evidenceCount=2);
  assert.equal(div(f).candidateEvidenceCount,1); assert.equal(evaluateHistoricalShadows(f).byStage.divergence.evidenceReductionPct,50);
  const other=fresh();other.engine_runs[0].id='run-2';other.stage_runs.forEach((s:any)=>{s.engine_run_id='run-2';s.id+='-other';});
  f.engine_runs.push(...other.engine_runs);f.stage_runs.push(...other.stage_runs);
  assert.equal(evaluateHistoricalShadows(f).aggregate.evidenceReductionPct,100/3);
  delete f.engine_runs[0].metadata.frozenInputs.evidence[0].affected_topics;assert.equal(div(f).status,'unevaluable');
});
test('linked rates context remains in reconstructed input and triggers would_run',()=>{
  const f=fresh();const e=structuredClone(f.engine_runs[0].metadata.frozenInputs.evidence[0]);
  e.id='rates';e.claim_text='Two year yield reprices policy expectations';e.provenance_urls=['https://example.com/yield'];
  e.structured_payload={itemKey:'rates-context:test',ratesContext:{triggerItemKeys:['release:1'],retrievedAt:'2026-09-09T23:30:00Z'}};
  f.engine_runs[0].metadata.frozenInputs.evidence.push(e);f.stage_runs[1].input_refs.evidenceCount=2;
  assert.equal(div(f).decision,'would_run');assert.equal(div(f).candidateEvidenceCount,2);
});
