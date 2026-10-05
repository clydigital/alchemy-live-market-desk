import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const source = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

test("reasoning authority chain stays canonical-evidence-first from Dossier A3 through Story mutation", () => {
  const a3 = source("lib/dossier-v2/reevaluation-propagation.ts");
  const review = source("lib/intelligence/story-review.ts");
  const runtime = source("lib/intelligence/runtime.ts");
  const provenance = source(
    "supabase/migrations/20261005190500_story_maintenance_evidence_provenance.sql",
  );

  // Dossier reasoning can request exact Story reevaluation, but the durable A3
  // queue authority is the canonical intelligence_evidence UUID.
  assert.match(a3, /source_kind\?: "dossier_story_evidence"/);
  assert.match(a3, /canonical_evidence_id: string/);
  assert.match(a3, /target_story_id: string/);
  assert.match(
    a3,
    /requested_by_evidence_id:\s*item\.canonical_evidence_id/,
  );
  assert.doesNotMatch(a3, /requested_by_motion_id/);

  // Existing Story mutation is gated by canonical-eligible Evidence.
  assert.match(review, /materialAssessmentHasEligibleEvidence/);
  assert.match(review, /isCanonicalEligibleEvidence\(item\)/);
  assert.match(runtime, /materialAssessmentHasEligibleEvidence\(assessment\.disposition, evidenceIds, target\)/);
  assert.match(runtime, /eligible_evidence_ids:\s*eligibleEvidenceIds/);
  assert.match(runtime, /Material mutation was suppressed because no eligible non-creator evidence was supplied/);

  // B4n records the exact material-authorising Evidence in the same immutable
  // Story maintenance context without adding another thesis-version writer.
  assert.match(provenance, /assessment\.eligible_evidence_ids/);
  assert.match(provenance, /eligibleIntelligenceEvidenceIds/);
  assert.match(provenance, /before update on public\.stories/i);
  assert.doesNotMatch(provenance, /create table/i);
  assert.doesNotMatch(provenance, /insert into public\.story_thesis_versions/i);
});

test("publication and Presenter replay preserve the exact immutable Story/Dossier vintage", () => {
  const publication = source("lib/hybrid-publication.ts");
  const replay = source("lib/presenter-historical-dossier-replay.ts");
  const hybrid = source("app/hybrid-output/page.tsx");

  // Publication hydrates reasoning from the exact thesis version selected for
  // the Story, rather than from current mutable Story fields.
  assert.match(publication, /story_thesis_versions/);
  assert.match(publication, /materialiseCanonicalStoryReasoningV1\(exactVersion\)/);
  assert.match(
    publication,
    /story\.thesisVersion\?\.id === exactVersion\.id/,
  );
  assert.match(publication, /canonicalStoryReasoning/);

  // Historical Presenter replay is exact UUID + exact as-of only.
  assert.match(
    replay,
    /getDossierV2PresentationSelectionById\(context\.dossierId!\)/,
  );
  assert.match(
    replay,
    /selection\.selectedDossierId !== context\.dossierId/,
  );
  assert.match(
    replay,
    /selection\.selectedAsOf !== context\.dossierAsOf/,
  );
  assert.doesNotMatch(replay, /getDossierV2PresentationSelection\(\)/);
  assert.doesNotMatch(replay, /nearest|closest|fuzzy/i);

  // Presenter may replay the selected immutable edition, while current Hybrid
  // reasoning and Motion remain tied to the current Dossier/current edition.
  assert.match(
    hybrid,
    /loadPresenterHistoricalDossierReplay\(selectedPresenterEdition\?\.payload\)/,
  );
  assert.match(
    hybrid,
    /presenterHistoricalDossierReplay\.selection\.presentation/,
  );
  assert.match(
    hybrid,
    /marketMotionFromEditionPayload\(currentEdition\?\.payload\)/,
  );
  assert.match(
    hybrid,
    /buildHybridReasoningProjection\(\{[\s\S]*?dossier,[\s\S]*?stories: data\.stories,[\s\S]*?events: recordLayer\.events,[\s\S]*?versions: recordLayer\.thesisVersions/,
  );
});

test("Presenter and Hybrid remain read-only consumers of canonical reasoning", () => {
  const files = [
    "lib/presenter-historical-dossier-replay.ts",
    "lib/presenter-canonical-story-bridge.ts",
    "lib/presenter-historical-context-boundary.ts",
    "app/hybrid-output/page.tsx",
    "lib/hybrid-reasoning-projection.ts",
  ].map(source);
  const combined = files.join("\n");

  assert.doesNotMatch(combined, /apply_intelligence_story_assessment_v2/);
  assert.doesNotMatch(combined, /insert into public\.story_thesis_versions/i);
  assert.doesNotMatch(combined, /intelligence_reevaluation_queue.*insert|insert.*intelligence_reevaluation_queue/i);
  assert.doesNotMatch(combined, /executeDossierStoryCanonicalMutation/);
  assert.doesNotMatch(combined, /persistCanonicalStoryReasoning/);
});
