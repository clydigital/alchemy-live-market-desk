import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDossierEvidenceSufficiency,
  DOSSIER_EVIDENCE_SUFFICIENCY_VERSION,
} from "../lib/dossier-v2/evidence-sufficiency.ts";

const STORY_ID = "story:rates";

function story(input: {
  confirming?: string[];
  contradicting?: string[];
  accelerating?: string[];
}) {
  return {
    story_id: STORY_ID,
    persistent_story_id: "11111111-1111-4111-8111-111111111111",
    market_evidence: {
      confirming: input.confirming ?? [],
      contradicting: input.contradicting ?? [],
      accelerating: input.accelerating ?? [],
      unresolved: [],
    },
  } as any;
}

function output(value: ReturnType<typeof story>) {
  return { major_stories: [value] } as any;
}

function governance(input: {
  active?: string[];
  superseded?: string[];
  missingProvenance?: string[];
  conflictRefs?: string[];
}) {
  const conflict = new Set(input.conflictRefs ?? []);
  return {
    contractVersion: "dossier-evidence-governance/1",
    asOf: "2026-10-05T12:00:00Z",
    items: [
      ...(input.active ?? []).map((ref) => ({
        evidenceId: ref,
        sourceType: "NEWS",
        availableAt: "2026-10-05T11:00:00Z",
        occurrenceTime: null,
        publishedAt: [],
        conflictGroupId: conflict.has(ref) ? "conflict:1" : null,
        supersededEvidenceIds: [],
        supersededByEvidenceIds: [],
        temporalState: "ACTIVE",
        sourceLineageKeys: (input.missingProvenance ?? []).includes(ref)
          ? []
          : [`news|${ref}|`],
        independentLineageCount: (input.missingProvenance ?? []).includes(ref)
          ? 0
          : 1,
      })),
      ...(input.superseded ?? []).map((ref) => ({
        evidenceId: ref,
        sourceType: "NEWS",
        availableAt: "2026-10-05T10:00:00Z",
        occurrenceTime: null,
        publishedAt: [],
        conflictGroupId: null,
        supersededEvidenceIds: [],
        supersededByEvidenceIds: ["ev:replacement"],
        temporalState: "SUPERSEDED",
        sourceLineageKeys: [`news|${ref}|`],
        independentLineageCount: 1,
      })),
    ],
    conflictGroups: conflict.size
      ? [{
          conflictGroupId: "conflict:1",
          evidenceIds: [...conflict],
          activeEvidenceIds: [...conflict],
          supersededEvidenceIds: [],
          activeIndependentLineageCount: conflict.size,
          resolution: "UNRESOLVED",
        }]
      : [],
    diagnostics: {
      duplicateEvidenceIds: [],
      missingProvenanceEvidenceIds: input.missingProvenance ?? [],
      unknownSupersededEvidenceIds: [],
      policy: [],
    },
  } as any;
}

test("new active canonical support strengthens without inventing a numeric confidence score", () => {
  const result = buildDossierEvidenceSufficiency({
    previous: output(story({ confirming: ["ev:old"] })),
    current: output(story({ confirming: ["ev:old", "ev:new"] })),
    governance: governance({ active: ["ev:old", "ev:new"] }),
  });

  assert.equal(
    result.contractVersion,
    DOSSIER_EVIDENCE_SUFFICIENCY_VERSION,
  );
  assert.equal(result.stories[0].direction, "STRENGTHEN");
  assert.deepEqual(result.stories[0].newSupportingEvidenceRefs, ["ev:new"]);
  assert.equal(result.stories[0].highConfidenceBlocked, false);
  assert.equal("score" in result.stories[0], false);
});

test("new active contradiction weakens and blocks high confidence", () => {
  const result = buildDossierEvidenceSufficiency({
    previous: output(story({ confirming: ["ev:support"] })),
    current: output(story({
      confirming: ["ev:support"],
      contradicting: ["ev:against"],
    })),
    governance: governance({ active: ["ev:support", "ev:against"] }),
  });

  assert.equal(result.stories[0].direction, "WEAKEN");
  assert.deepEqual(
    result.stories[0].newContradictingEvidenceRefs,
    ["ev:against"],
  );
  assert.ok(result.stories[0].blockers.includes("ACTIVE_CONTRADICTION"));
  assert.equal(result.stories[0].highConfidenceBlocked, true);
});

test("simultaneous new support and contradiction remains unresolved", () => {
  const result = buildDossierEvidenceSufficiency({
    previous: output(story({ confirming: ["ev:prior"] })),
    current: output(story({
      confirming: ["ev:prior", "ev:for"],
      contradicting: ["ev:against"],
    })),
    governance: governance({
      active: ["ev:prior", "ev:for", "ev:against"],
      conflictRefs: ["ev:for", "ev:against"],
    }),
  });

  assert.equal(result.stories[0].direction, "UNRESOLVED");
  assert.ok(result.stories[0].blockers.includes("UNRESOLVED_CONFLICT"));
  assert.equal(result.stories[0].highConfidenceBlocked, true);
});

test("explicitly superseded supporting evidence weakens when no replacement support exists", () => {
  const result = buildDossierEvidenceSufficiency({
    previous: output(story({ confirming: ["ev:old"] })),
    current: output(story({ confirming: ["ev:old"] })),
    governance: governance({ superseded: ["ev:old"] }),
  });

  assert.equal(result.stories[0].direction, "WEAKEN");
  assert.deepEqual(
    result.stories[0].supersededSupportingEvidenceRefs,
    ["ev:old"],
  );
  assert.ok(result.stories[0].blockers.includes("SUPERSEDED_SUPPORT"));
  assert.ok(result.stories[0].blockers.includes("NO_ACTIVE_SUPPORT"));
});

test("missing provenance blocks high confidence without changing evidence direction by itself", () => {
  const result = buildDossierEvidenceSufficiency({
    previous: output(story({ confirming: ["ev:old"] })),
    current: output(story({ confirming: ["ev:old"] })),
    governance: governance({
      active: ["ev:old"],
      missingProvenance: ["ev:old"],
    }),
  });

  assert.equal(result.stories[0].direction, "UNCHANGED");
  assert.ok(result.stories[0].blockers.includes("MISSING_PROVENANCE"));
  assert.equal(result.stories[0].highConfidenceBlocked, true);
});
