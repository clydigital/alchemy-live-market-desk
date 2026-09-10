# Read-only historical shadow evaluation

Run with Node 22.6+ using the repository's existing TypeScript stripping convention:

```sh
node --experimental-strip-types scripts/evaluate-historical-shadows.ts historical-export.json reports/new-evaluation
```

The command reads one JSON export and creates historical-shadow-evaluation.json and historical-shadow-evaluation.md. Existing report files are not overwritten. It has no database credentials, network calls, model calls, runtime imports, stage claims, or persistence operations. No production route or shadow function changes are included.

The input is an object with engine_runs and stage_runs arrays, exported in one consistent read-only database snapshot. Include completed intelligence_engine_runs with id, status, completed_at and metadata.frozenInputs (analysisAsOf and the original ordered evidence rows). Include intelligence_stage_runs with id, engine_run_id, stage_key, status, started_at, completed_at, input_refs, output_payload, and provider_request_id. Only market_belief and divergence checkpoints are needed. Do not replace frozen evidence with current Evidence, Story, or belief table reads. Preserve null and missing fields rather than inserting defaults.

A production-shaped synthetic example is tests/fixtures/historical-shadow-run.json. It is test data, not a measured production sample. Raw exports should remain outside Git. Only the identifier/count report should be shared after review.

## Reconstruction

Market Belief uses the explicit evidenceCount and storyReviewTargetCount saved in checkpoint input_refs. These are exact sufficient statistics for the merged helper, which only examines the two input array lengths. The evaluator supplies count carriers, not synthetic Evidence records. Missing counts remain unevaluable. All three output arrays are required; unchanged assessments are non-material, while beliefs, recruited clusters, and other valid assessment dispositions are observed by the existing helper.

Divergence rebuilds the canonical Evidence pack from ordered frozen database rows, calls the merged fresh-news recruiter and rates-context attachment, and checks both upstream and Divergence persisted evidence counts. It projects the exact belief fields required by the shadows using the recruitment-cluster/evidence and asset filtering in runtime.persistRecruitmentClusters/persistBeliefs. Ambiguous cluster/belief upserts, missing snapshots, malformed outputs, chronology problems, mismatched counts and unreconstructable beliefs are unevaluable. It never reads the mutable belief table. This projection must be reviewed alongside changes to those production persistence filters.

Both the digest builder and stage-admission decision/result helpers are imported directly. The digest is a packet selector and has no would_run/would_skip decision; its counts are attached to the Divergence admission row. Full-input actual results cannot establish whether the proposed compact packet would produce equivalent results. Stage skipping remains disabled.

One latest completed attempt is considered per run-stage. Failed attempts are ignored; tied latest timestamps and malformed latest completed outputs fail closed. Missing stages remain unevaluable and never count as calls saved. Incomplete engine runs are excluded and counted. This intentionally does not backfill an invalid latest checkpoint with an older output.

## Metrics

- Sample size: evaluable run-stage rows; per-stage breakdowns are primary.
- Proposed skip rate: would_skip / evaluable rows.
- False-skip rate: material outputs among would_skip rows / would_skip rows.
- False-run rate: non-material outputs among would_run rows / would_run rows.
- Evidence reduction: 1 - total candidate / total source Evidence across evaluable Divergence digests. This is weighted, not an average of run percentages.
- Estimated avoidable model-stage calls: true_skip rows with a persisted provider_request_id. This counts at most one observed stage call per checkpoint, excludes retries, missing stages, and false skips, and is not a monetary estimate.
- Actual output count: all Divergence entries; Market Belief beliefs + all clusters + all Story assessments. Non-material output entries can therefore have a nonzero count.

Unevaluable rows never enter rate denominators. Zero denominators yield null in JSON and N/A in Markdown. Run timestamp is completed_at; checkpoint ID identifies the selected attempt. Input SHA-256 identifies the exact export. These are retrospective current-rule measurements, not claims that every historic run used today's shadow versions.

## Validation and promotion

Run the focused test and normal repository test/typecheck/build/database-contract checks before merging. The fixture covers frozen database rows, full Market Belief output shape and completed model checkpoints, plus missing/malformed state, material output, non-material assessments, attempt selection and ambiguous persistence cases. No tests should write production data or invoke providers. Do not activate skipping or compact Divergence inputs based on this PR.
