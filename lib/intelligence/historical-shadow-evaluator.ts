import { buildDivergenceDigestShadow } from './divergence-digest-shadow.ts';
import { buildDivergenceStageAdmissionShadow, observeDivergenceStageAdmissionShadow } from './stage-admission-shadow.ts';
import { buildMarketBeliefAdmissionShadow, observeMarketBeliefAdmissionShadow } from './market-belief-stage-admission-shadow.ts';
import { buildFreshNewsRecruitment } from './fresh-news-recruitment.ts';
import { attachRatesContext, isRatesContext } from './rates-context.ts';
import { normaliseInstrument } from '../instrument-mentions.ts';
import type { EvidencePackItem } from './schemas.ts';

/** Offline only. The caller supplies an export; no database/provider runtime imports. */
export type HistoricalExport = {
  engine_runs: Array<Record<string, unknown>>;
  stage_runs: Array<Record<string, unknown>>;
};
type RecordValue = Record<string, any>;
export type EvaluationRow = {
  runId: string; timestamp: string | null; stage: 'market_belief' | 'divergence';
  checkpointId: string | null; status: 'evaluated' | 'unevaluable'; reason: string;
  decision: 'would_run' | 'would_skip' | null;
  sourceEvidenceCount: number | null; candidateEvidenceCount: number | null;
  actualOutputCount: number | null; actualMaterialResult: boolean | null;
  classification: 'false_skip' | 'false_run' | 'true_skip' | 'true_run' | 'unevaluable';
  digest: ReturnType<typeof buildDivergenceDigestShadow> extends infer T ? Omit<T, 'evidence' | 'evidenceIds'> | null : never;
  reconstruction: string | null; modelCallObserved: boolean;
};
function object(v: unknown): v is RecordValue { return !!v && typeof v === 'object' && !Array.isArray(v); }
function requireValue(v: unknown, reason: string): asserts v { if (!v) throw new Error(reason); }
function strings(v: unknown): v is string[] { return Array.isArray(v) && v.every(x => typeof x === 'string'); }
function count(v: unknown): v is number { return Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= 1000000; }
function validTime(v: unknown): v is string { return typeof v === 'string' && Number.isFinite(Date.parse(v)); }
function unique<T>(v: T[]): T[] { return [...new Set(v)]; }

/** Preserve frozen row order. Missing fields are not replaced with contemporary data. */
function evidencePack(value: unknown): EvidencePackItem[] {
  requireValue(Array.isArray(value), 'missing_frozen_evidence');
  const ids = new Set<string>();
  return value.map((row: unknown) => {
    requireValue(object(row) && typeof row.id === 'string' && row.id && !ids.has(row.id), 'invalid_or_duplicate_frozen_evidence');
    ids.add(row.id);
    requireValue(typeof row.claim_text === 'string' && typeof row.evidence_class === 'string'
      && typeof row.support_direction === 'string' && typeof row.freshness_status === 'string'
      && (row.summary === null || typeof row.summary === 'string'), 'incomplete_frozen_evidence');
    for (const key of ['event_at','published_at','available_at','received_at']) {
      requireValue(row[key] === null || validTime(row[key]), 'invalid_frozen_evidence_timestamp');
    }
    for (const key of ['affected_assets','affected_topics','provenance_urls']) requireValue(strings(row[key]), 'incomplete_frozen_evidence_arrays');
    const structuredPayload = row.structured_payload === null ? {} : row.structured_payload;
    requireValue(object(structuredPayload), 'missing_frozen_structured_payload');
    requireValue(Object.hasOwn(row, 'source'), 'missing_frozen_source');
    requireValue(!Array.isArray(row.source) || row.source.length <= 1, 'ambiguous_frozen_source');
    const source = Array.isArray(row.source) ? row.source[0] : row.source;
    requireValue(source == null || (object(source) && typeof source.source_tier === 'number'
      && Number.isFinite(Number(source.reliability_score)) && Object.hasOwn(source,'ancestry_group_id')), 'incomplete_frozen_source');
    return {
      id: row.id, claim: row.claim_text, summary: row.summary, evidenceClass: row.evidence_class,
      sourceName: source?.source_name || 'Unknown source', sourceTier: source?.source_tier ?? 5,
      reliabilityScore: Number(source?.reliability_score ?? 0), ancestryGroupId: source?.ancestry_group_id ?? null,
      supportDirection: row.support_direction, eventAt: row.event_at, publishedAt: row.published_at,
      availableAt: row.available_at, receivedAt: row.received_at, freshnessStatus: row.freshness_status,
      affectedAssets: row.affected_assets, affectedTopics: row.affected_topics, provenanceUrls: row.provenance_urls,
      providerKey: source?.provider_key ?? null, structuredPayload,
    };
  });
}

function marketOutput(value: unknown): RecordValue {
  requireValue(object(value) && Array.isArray(value.beliefs) && Array.isArray(value.recruitmentClusters)
    && Array.isArray(value.storyAssessments), 'incomplete_market_belief_output');
  requireValue(value.beliefs.every((v: unknown) => object(v) && typeof v.statement === 'string'
    && strings(v.evidenceIds) && strings(v.affectedAssets) && strings(v.recruitmentClusterKeys)), 'invalid_belief_output');
  requireValue(value.recruitmentClusters.every((v: unknown) => object(v) && typeof v.clusterKey === 'string'
    && strings(v.evidenceIds) && ['recruit','context','defer'].includes(v.verdict)), 'invalid_cluster_output');
  requireValue(value.storyAssessments.every((v: unknown) => object(v) && typeof v.storyId === 'string'
    && ['unchanged','reinforced','weakened','reframed','invalidated'].includes(v.disposition)), 'invalid_story_assessment_output');
  return value;
}

/** Reconstruct only the fields consumed by the shadows, following persistRecruitmentClusters/persistBeliefs.
 * Ambiguous upserts are rejected; mutable intelligence_market_beliefs rows are never read.
 */
function beliefProjection(output: RecordValue, evidence: EvidencePackItem[], candidateIds: Set<string>) {
  const byId = new Map(evidence.map(v => [v.id, v]));
  const clusters = new Map<string, { ids: string[]; verdict: string }>();
  const evidenceSets = new Set<string>();
  for (const c of output.recruitmentClusters) {
    const key = c.clusterKey.trim();
    if (!key) continue;
    requireValue(key.length <= 120 && !clusters.has(key), 'ambiguous_cluster_keys');
    const ids = unique<string>(c.evidenceIds).filter(id => candidateIds.has(id));
    if (!ids.length) continue;
    const signature = JSON.stringify([...ids].sort());
    requireValue(!evidenceSets.has(signature), 'ambiguous_cluster_upsert');
    evidenceSets.add(signature);
    clusters.set(key, { ids, verdict: c.verdict });
  }
  const keys = new Set<string>();
  return output.beliefs.flatMap((b: RecordValue) => {
    const recruited = unique<string>(b.recruitmentClusterKeys).map(key => clusters.get(key)).filter(c => c?.verdict === 'recruit');
    if (!recruited.length || !b.statement.trim()) return [];
    const allowed = new Set(recruited.flatMap(c => c!.ids));
    const ids = unique<string>(b.evidenceIds).filter(id => byId.has(id) && allowed.has(id));
    if (!ids.length) return [];
    const key = JSON.stringify([b.statement.trim().toLowerCase(), [...b.affectedAssets].sort()]);
    requireValue(!keys.has(key), 'ambiguous_belief_upsert'); keys.add(key);
    const assets = new Set(ids.flatMap(id => byId.get(id)!.affectedAssets).map(normaliseInstrument));
    return [{ evidence_ids: ids, affected_assets: unique<string>(b.affectedAssets.filter((a: string) => assets.has(normaliseInstrument(a)))) }];
  });
}

function checkpoint(rows: RecordValue[], stage: string): RecordValue {
  const completed = rows.filter(r => r.stage_key === stage && r.status === 'completed');
  requireValue(completed.length > 0, 'missing_completed_checkpoint');
  requireValue(completed.every(r => typeof r.id === 'string' && validTime(r.completed_at) && validTime(r.started_at)), 'invalid_checkpoint_identity_or_timestamp');
  // Production chooses newest completed payload. Never fall back to an older output when latest is malformed.
  completed.sort((a,b) => Date.parse(b.completed_at) - Date.parse(a.completed_at) || Date.parse(b.started_at) - Date.parse(a.started_at));
  requireValue(completed.length < 2 || completed[0].completed_at !== completed[1].completed_at
    || completed[0].started_at !== completed[1].started_at, 'ambiguous_completed_attempts');
  return completed[0];
}

export function evaluateHistoricalShadows(input: HistoricalExport) {
  requireValue(object(input) && Array.isArray(input.engine_runs) && Array.isArray(input.stage_runs), 'invalid_export');
  requireValue(input.engine_runs.every(r => object(r) && typeof r.id === 'string' && r.id), 'invalid_engine_run');
  requireValue(input.stage_runs.every(object), 'invalid_stage_row');
  requireValue(new Set(input.engine_runs.map(r => r.id)).size === input.engine_runs.length, 'duplicate_engine_runs');
  requireValue(new Set(input.stage_runs.map(r => r.id)).size === input.stage_runs.length, 'duplicate_checkpoint_ids');
  const rows: EvaluationRow[] = [];
  for (const run of input.engine_runs) {
    if (run.status !== 'completed') continue;
    for (const stage of ['market_belief','divergence'] as const) {
      const row: EvaluationRow = { runId: run.id as string, timestamp: validTime(run.completed_at) ? run.completed_at : null,
        stage, checkpointId: null, status: 'unevaluable', reason: '', decision: null,
        sourceEvidenceCount: null, candidateEvidenceCount: null, actualOutputCount: null, actualMaterialResult: null,
        classification: 'unevaluable', digest: null, reconstruction: null, modelCallObserved: false };
      try {
        requireValue(validTime(run.completed_at), 'missing_run_timestamp');
        const stageRows = input.stage_runs.filter(r => r.engine_run_id === run.id);
        const cp = checkpoint(stageRows, stage);
        row.checkpointId = cp.id;
        requireValue(Date.parse(cp.started_at) <= Date.parse(cp.completed_at)
          && Date.parse(cp.completed_at) <= Date.parse(run.completed_at), 'invalid_checkpoint_chronology');
        row.modelCallObserved = typeof cp.provider_request_id === 'string' && cp.provider_request_id.length > 0;
        if (stage === 'market_belief') {
          const output = marketOutput(cp.output_payload);
          requireValue(object(cp.input_refs) && count(cp.input_refs.evidenceCount)
            && count(cp.input_refs.storyReviewTargetCount), 'missing_persisted_admission_counts');
          // The exact merged admission helper observes array lengths only. Explicit count carriers
          // preserve that sufficient statistic; these are not invented Evidence or Story records.
          const decision = buildMarketBeliefAdmissionShadow({
            freshEvidenceCandidates: new Array(cp.input_refs.evidenceCount),
            storyReviewTargets: new Array(cp.input_refs.storyReviewTargetCount),
          });
          const actual = observeMarketBeliefAdmissionShadow(decision, output);
          Object.assign(row, { decision: decision.decision, reason: decision.reason,
            sourceEvidenceCount: decision.freshEvidenceCandidateCount,
            actualOutputCount: output.beliefs.length + output.recruitmentClusters.length + output.storyAssessments.length,
            actualMaterialResult: actual.actualMaterialResult, reconstruction: 'checkpoint_input_refs_exact_counts' });
        } else {
          const output = cp.output_payload;
          requireValue(object(output) && Array.isArray(output.divergences) && output.divergences.every((d: unknown) => object(d)
            && typeof d.marketBeliefId === 'string' && typeof d.observedChange === 'string' && strings(d.decisiveEvidenceIds)), 'invalid_divergence_output');
          requireValue(object(run.metadata) && object(run.metadata.frozenInputs), 'missing_frozen_inputs');
          const frozen = run.metadata.frozenInputs;
          requireValue(validTime(frozen.analysisAsOf) && Date.parse(frozen.analysisAsOf) <= Date.parse(cp.started_at), 'invalid_frozen_analysis_time');
          const universe = evidencePack(frozen.evidence);
          const recruitment = buildFreshNewsRecruitment(universe.filter(e => !isRatesContext(e)), frozen.analysisAsOf);
          const evidence = attachRatesContext(recruitment.candidates.map(c => c.evidence), universe, frozen.analysisAsOf);
          requireValue(object(cp.input_refs) && cp.input_refs.evidenceCount === evidence.length, 'divergence_evidence_count_mismatch');
          const upstream = checkpoint(stageRows, 'market_belief');
          requireValue(Date.parse(upstream.completed_at) <= Date.parse(cp.started_at), 'upstream_checkpoint_after_divergence');
          requireValue(object(upstream.input_refs) && upstream.input_refs.evidenceCount === recruitment.candidates.length, 'upstream_evidence_count_mismatch');
          const beliefs = beliefProjection(marketOutput(upstream.output_payload), evidence, new Set(recruitment.candidates.map(c => c.evidence.id)));
          // Production exits before Divergence when no beliefs persist. Do not count this as a saved call.
          requireValue(beliefs.length > 0, 'divergence_checkpoint_without_reconstructable_beliefs');
          const shadowInput = { beliefs, evidence };
          const digest = buildDivergenceDigestShadow(shadowInput);
          const decision = buildDivergenceStageAdmissionShadow(shadowInput);
          const actual = observeDivergenceStageAdmissionShadow(decision, output);
          const { evidence: omittedEvidence, evidenceIds: omittedIds, ...counts } = digest;
          Object.assign(row, { decision: decision.decision, reason: decision.reason, sourceEvidenceCount: decision.sourceEvidenceCount,
            candidateEvidenceCount: decision.candidateEvidenceCount, actualOutputCount: actual.actualOutputCount,
            actualMaterialResult: actual.actualMaterialResult, digest: counts, reconstruction: 'frozen_evidence_and_upstream_checkpoint' });
        }
        row.status = 'evaluated';
        row.classification = row.decision === 'would_skip'
          ? row.actualMaterialResult ? 'false_skip' : 'true_skip'
          : row.actualMaterialResult ? 'true_run' : 'false_run';
      } catch (error) {
        row.reason = error instanceof Error ? error.message : 'reconstruction_failed';
        row.decision = null; row.actualOutputCount = null; row.actualMaterialResult = null;
        row.sourceEvidenceCount = null; row.candidateEvidenceCount = null; row.digest = null;
      }
      rows.push(row);
    }
  }
  const percent = (n: number, d: number) => d ? 100 * n / d : null;
  const aggregate = (subset: EvaluationRow[]) => {
    const evaluated = subset.filter(r => r.status === 'evaluated');
    const skips = evaluated.filter(r => r.decision === 'would_skip');
    const runs = evaluated.filter(r => r.decision === 'would_run');
    const compact = evaluated.filter(r => r.digest !== null);
    const source = compact.reduce((n,r) => n + r.sourceEvidenceCount!, 0);
    const candidate = compact.reduce((n,r) => n + r.candidateEvidenceCount!, 0);
    return { sampleSize: evaluated.length, unevaluableCount: subset.length - evaluated.length,
      proposedSkipCount: skips.length, falseSkipCount: skips.filter(r => r.classification === 'false_skip').length,
      falseRunCount: runs.filter(r => r.classification === 'false_run').length,
      proposedSkipRatePct: percent(skips.length,evaluated.length),
      falseSkipRatePct: percent(skips.filter(r => r.classification === 'false_skip').length,skips.length),
      falseRunRatePct: percent(runs.filter(r => r.classification === 'false_run').length,runs.length),
      evidenceReductionPct: percent(source-candidate,source), digestSampleSize: compact.length,
      sourceEvidenceCount: source, candidateEvidenceCount: candidate,
      estimatedAvoidableModelStageCalls: skips.filter(r => r.classification === 'true_skip' && r.modelCallObserved).length };
  };
  return { schemaVersion: 'historical-shadows-v1', completedRunCount: input.engine_runs.filter(r => r.status === 'completed').length,
    excludedIncompleteRunCount: input.engine_runs.filter(r => r.status !== 'completed').length,
    definitions: { sampleUnit: 'run-stage; one latest completed checkpoint per stage',
      falseSkipRate: 'false_skip / would_skip', falseRunRate: 'false_run / would_run',
      evidenceReduction: '1 - sum(candidate evidence) / sum(source evidence), Divergence digest only',
      avoidableCalls: 'true_skip checkpoints with a persisted provider_request_id; retries and absent stages excluded',
      actualOutputCount: 'Divergence entries; Market Belief beliefs + all clusters + all assessments',
      digestDecision: 'not applicable: digest is a packet selector, admission decision is reported separately',
      limitation: 'Retrospective merged-rule replay; observed full-input output does not establish compact-packet output equivalence.' },
    aggregate: aggregate(rows), byStage: { market_belief: aggregate(rows.filter(r=>r.stage==='market_belief')), divergence: aggregate(rows.filter(r=>r.stage==='divergence')) }, rows };
}

export function historicalShadowMarkdown(report: ReturnType<typeof evaluateHistoricalShadows>): string {
  const fmt = (v: unknown) => v === null ? 'N/A' : typeof v === 'number' ? Number.isInteger(v) ? String(v) : v.toFixed(2) : String(v);
  const cell = (v: unknown) => fmt(v).replaceAll('|',String.fromCharCode(92)+'|').replace(/[\r\n]/g,' ');
  const lines = ['# Historical shadow evaluation', '', 'Read-only retrospective replay. No model calls or stage skipping.', '',
    '| Stage | Sample | Unevaluable | Skip % | False-skip % | False-run % | Evidence reduction % | Avoidable calls |',
    '|---|---:|---:|---:|---:|---:|---:|---:|'];
  for (const [stage,s] of Object.entries(report.byStage)) lines.push('| '+[stage,s.sampleSize,s.unevaluableCount,s.proposedSkipRatePct,s.falseSkipRatePct,s.falseRunRatePct,s.evidenceReductionPct,s.estimatedAvoidableModelStageCalls].map(cell).join(' | ')+' |');
  lines.push('', 'False-skip denominator: proposed skips. False-run denominator: proposed runs. Unevaluable cases are excluded; zero denominators are N/A.',
    'Evidence reduction is weighted across evaluable Divergence digests. Avoidable calls require an observed provider request and a non-material actual result.',
    'The digest has no admission decision. Full-input outputs cannot prove compact-input safety.', '',
    '| Run | Timestamp | Stage | Checkpoint | Decision | Reason | Source | Candidate | Outputs | Material | Classification |',
    '|---|---|---|---|---|---|---:|---:|---:|---|---|');
  for (const r of report.rows) lines.push('| '+[r.runId,r.timestamp,r.stage,r.checkpointId,r.decision,r.reason,r.sourceEvidenceCount,r.candidateEvidenceCount,r.actualOutputCount,r.actualMaterialResult,r.classification].map(cell).join(' | ')+' |');
  return lines.join('\n')+'\n';
}
