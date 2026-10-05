import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDossierEvidenceGovernance,
  DOSSIER_EVIDENCE_GOVERNANCE_VERSION,
} from "../lib/dossier-v2/evidence-governance.ts";

function packet() {
  return {
    as_of: "2026-10-05T12:00:00.000Z",
    observed_evidence: [
      {
        evidence_id: "ev:old",
        epistemic_label: "OBSERVED",
        claim_or_fact: "Preliminary reading.",
        category: "MACRO",
        source_type: "OFFICIAL_DATA",
        available_at: "2026-10-05T09:00:00.000Z",
        conflict_group_id: "conflict:macro",
        provenance: [{
          source_type: "OFFICIAL_DATA",
          source_id: "release-1",
          url: "https://example.test/release",
          published_at: "2026-10-05T09:00:00.000Z",
        }],
      },
      {
        evidence_id: "ev:revised",
        epistemic_label: "OBSERVED",
        claim_or_fact: "Revised reading.",
        category: "MACRO",
        source_type: "OFFICIAL_DATA",
        available_at: "2026-10-05T10:00:00.000Z",
        conflict_group_id: "conflict:macro",
        superseded_evidence_ids: ["ev:old"],
        provenance: [{
          source_type: "OFFICIAL_DATA",
          source_id: "release-1",
          url: "https://example.test/release",
          published_at: "2026-10-05T10:00:00.000Z",
        }],
      },
      {
        evidence_id: "ev:side-a",
        epistemic_label: "OBSERVED",
        claim_or_fact: "Independent account A.",
        category: "CREDIT",
        source_type: "NEWS",
        available_at: "2026-10-05T10:30:00.000Z",
        conflict_group_id: "conflict:credit",
        provenance: [{
          source_type: "NEWS",
          source_id: "source-a",
          url: "https://a.example.test/item",
        }],
      },
      {
        evidence_id: "ev:side-b",
        epistemic_label: "OBSERVED",
        claim_or_fact: "Independent account B.",
        category: "CREDIT",
        source_type: "NEWS",
        available_at: "2026-10-05T10:31:00.000Z",
        conflict_group_id: "conflict:credit",
        provenance: [{
          source_type: "NEWS",
          source_id: "source-b",
          url: "https://b.example.test/item",
        }],
      },
      {
        evidence_id: "ev:duplicate-lineage",
        epistemic_label: "OBSERVED",
        claim_or_fact: "Derivative copy of account A.",
        category: "CREDIT",
        source_type: "NEWS",
        available_at: "2026-10-05T10:32:00.000Z",
        provenance: [{
          source_type: "NEWS",
          source_id: "source-a",
          url: "https://a.example.test/item",
        }],
      },
    ],
    rate_context: { evidence: [] },
  } as any;
}

test("explicit supersession preserves history while resolving the conflict group", () => {
  const snapshot = buildDossierEvidenceGovernance(packet());

  assert.equal(
    snapshot.contractVersion,
    DOSSIER_EVIDENCE_GOVERNANCE_VERSION,
  );

  const old = snapshot.items.find((item) => item.evidenceId === "ev:old");
  const revised = snapshot.items.find(
    (item) => item.evidenceId === "ev:revised",
  );
  assert.equal(old?.temporalState, "SUPERSEDED");
  assert.deepEqual(old?.supersededByEvidenceIds, ["ev:revised"]);
  assert.equal(revised?.temporalState, "ACTIVE");

  const group = snapshot.conflictGroups.find(
    (item) => item.conflictGroupId === "conflict:macro",
  );
  assert.equal(group?.resolution, "RESOLVED_BY_SUPERSESSION");
  assert.deepEqual(group?.activeEvidenceIds, ["ev:revised"]);
  assert.deepEqual(group?.supersededEvidenceIds, ["ev:old"]);
});

test("independent active evidence on both sides remains an unresolved conflict", () => {
  const snapshot = buildDossierEvidenceGovernance(packet());
  const group = snapshot.conflictGroups.find(
    (item) => item.conflictGroupId === "conflict:credit",
  );

  assert.equal(group?.resolution, "UNRESOLVED");
  assert.deepEqual(group?.activeEvidenceIds, ["ev:side-a", "ev:side-b"]);
  assert.equal(group?.activeIndependentLineageCount, 2);
});

test("source independence uses exact provenance lineage rather than document count", () => {
  const snapshot = buildDossierEvidenceGovernance(packet());
  const a = snapshot.items.find((item) => item.evidenceId === "ev:side-a");
  const copy = snapshot.items.find(
    (item) => item.evidenceId === "ev:duplicate-lineage",
  );

  assert.deepEqual(a?.sourceLineageKeys, copy?.sourceLineageKeys);
  assert.equal(a?.independentLineageCount, 1);
  assert.equal(copy?.independentLineageCount, 1);
  assert.match(snapshot.diagnostics.policy[2], /no fuzzy semantic matching/i);
});

test("unknown superseded refs remain visible for audit instead of being invented", () => {
  const value = packet();
  value.observed_evidence[1].superseded_evidence_ids = [
    "ev:old",
    "ev:not-in-packet",
  ];

  const snapshot = buildDossierEvidenceGovernance(value);
  assert.deepEqual(
    snapshot.diagnostics.unknownSupersededEvidenceIds,
    ["ev:not-in-packet"],
  );
});
