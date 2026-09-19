import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildCandidateSnapshotFromCanonicalEvidence,
  type CanonicalEvidenceRow,
  type CanonicalSnapshotResult,
} from "../lib/dossier-v2/canonical-snapshot.ts";
import { runManualDossierV2 } from "../lib/dossier-v2/manual-run.ts";
import type { ModelRunner } from "../lib/dossier-v2/research-brain.ts";

const AS_OF = "2026-09-20T00:00:00.000Z";

function source(overrides: Record<string, unknown> = {}) {
  return {
    id: "source-1",
    ancestry_group_id: "ancestry-1",
    external_source_id: "external-source-1",
    source_name: "Primary Source",
    source_type: "news",
    source_url: "https://example.com",
    source_tier: 1,
    reliability_score: 100,
    provider_key: "research_intake",
    ...overrides,
  };
}

function baseRow(overrides: Partial<CanonicalEvidenceRow>): CanonicalEvidenceRow {
  return {
    id: "row-1",
    external_evidence_id: "external-1",
    claim_text: "Canonical evidence claim.",
    evidence_class: "news_report",
    support_direction: "context",
    available_at: "2026-09-19T20:00:00.000Z",
    received_at: "2026-09-19T20:01:00.000Z",
    freshness_status: "current",
    affected_assets: [],
    affected_topics: [],
    provenance_urls: ["https://example.com/evidence"],
    structured_payload: {},
    source: source(),
    ...overrides,
  };
}

test("Task 9 adapter separates direct evidence, creator leads, and future catalysts", () => {
  const rows: CanonicalEvidenceRow[] = [
    baseRow({
      id: "official",
      external_evidence_id: "ev:official",
      evidence_class: "official_release",
      claim_text: "Official release changed the policy rate.",
      affected_topics: ["monetary-policy"],
      source: source({
        id: "fed-source",
        ancestry_group_id: "fed-ancestry",
        source_name: "Federal Reserve",
      }),
    }),
    baseRow({
      id: "market",
      external_evidence_id: "ev:market",
      evidence_class: "market_observation",
      claim_text: "US 2Y yield moved after the release.",
      affected_assets: ["US02Y"],
      source: source({
        id: "market-source",
        ancestry_group_id: "market-ancestry",
        source_name: "Market Feed",
        source_type: "market_data",
      }),
    }),
    baseRow({
      id: "creator",
      external_evidence_id: "lead:creator",
      evidence_class: "transcript",
      claim_text: "Creator argues the move reflects positioning.",
      structured_payload: {
        evidenceNature: "creator_lead",
        candidateScore: 88,
      },
      source: source({
        id: "creator-source",
        ancestry_group_id: "youtube-ancestry",
        source_name: "Creator Channel",
        source_type: "video",
        source_tier: 5,
      }),
    }),
    baseRow({
      id: "future-event",
      external_evidence_id: "event:future",
      evidence_class: "other",
      claim_text: "Scheduled central bank event.",
      event_at: "2026-09-21T12:00:00.000Z",
      structured_payload: {
        evidenceNature: "scheduled_event",
        title: "Central bank decision",
        materiality: 95,
      },
      source: source({
        id: "calendar-source",
        ancestry_group_id: "calendar-ancestry",
        source_name: "Central Bank",
      }),
    }),
    baseRow({
      id: "expired-event",
      external_evidence_id: "event:expired",
      evidence_class: "other",
      claim_text: "Old scheduled event.",
      event_at: "2026-09-19T12:00:00.000Z",
      structured_payload: {
        evidenceNature: "scheduled_event",
        title: "Expired central bank event",
      },
    }),
  ];

  const result = buildCandidateSnapshotFromCanonicalEvidence(rows, {
    asOf: AS_OF,
    lookbackHours: 168,
  });

  assert.equal(result.diagnostics.observed_count, 2);
  assert.equal(result.diagnostics.lead_count, 1);
  assert.equal(result.diagnostics.catalyst_count, 1);
  assert.equal(result.diagnostics.skipped_expired_scheduled_count, 1);
  assert.equal(result.diagnostics.price_data_status, "OK");
  assert.equal(result.diagnostics.macro_data_status, "OK");

  const observed = result.snapshot.observed_evidence ?? [];
  assert.equal(observed.length, 2);
  assert.equal(observed[0]?.source_type, "OFFICIAL_DATA");
  assert.equal(observed[1]?.source_type, "MARKET_DATA");

  const officialProv = observed[0]?.provenance as Array<Record<string, unknown>>;
  assert.equal(officialProv[0]?.source_id, "fed-ancestry");

  const leads = result.snapshot.research_leads ?? [];
  assert.equal(leads.length, 1);
  assert.equal(leads[0]?.source_type, "CREATOR_LEAD");
  assert.equal(leads[0]?.urgency, "HIGH");

  const catalysts = result.snapshot.catalysts ?? [];
  assert.equal(catalysts.length, 1);
  assert.equal(catalysts[0]?.catalyst_id, "event:future");
});

test("Task 9 adapter never promotes news reports or creator transcripts to observed evidence", () => {
  const rows: CanonicalEvidenceRow[] = [
    baseRow({
      id: "news",
      external_evidence_id: "lead:news",
      evidence_class: "news_report",
      claim_text: "Named-source report requires verification.",
    }),
    baseRow({
      id: "creator",
      external_evidence_id: "lead:video",
      evidence_class: "transcript",
      claim_text: "Creator interpretation.",
      source: source({
        source_type: "video",
        source_name: "StockedUp",
        source_tier: 5,
      }),
    }),
  ];

  const result = buildCandidateSnapshotFromCanonicalEvidence(rows, {
    asOf: AS_OF,
  });

  assert.equal(result.snapshot.observed_evidence?.length, 0);
  assert.equal(result.snapshot.research_leads?.length, 2);
  assert.equal(result.diagnostics.price_data_status, "MISSING");
  assert.equal(result.diagnostics.macro_data_status, "MISSING");
});

test("Task 9 adapter excludes evidence that was not available by as_of", () => {
  const rows: CanonicalEvidenceRow[] = [
    baseRow({
      id: "future-evidence",
      evidence_class: "official_release",
      available_at: "2026-09-20T01:00:00.000Z",
      received_at: "2026-09-20T01:01:00.000Z",
    }),
  ];

  const result = buildCandidateSnapshotFromCanonicalEvidence(rows, {
    asOf: AS_OF,
  });

  assert.equal(result.diagnostics.rows_considered, 0);
  assert.equal(result.diagnostics.skipped_future_count, 1);
  assert.equal(result.snapshot.observed_evidence?.length, 0);
});

function missingDossierTableClient(): SupabaseClient {
  return {
    from(table: string) {
      assert.equal(table, "market_dossiers_v2");
      return {
        select(_fields: string) {
          return {
            order(_column: string, _options: unknown) {
              return {
                limit(_limit: number) {
                  return {
                    async maybeSingle() {
                      return {
                        data: null,
                        error: {
                          code: "PGRST205",
                          message:
                            "Could not find the table 'public.market_dossiers_v2' in the schema cache",
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

function leadOnlySnapshot(): CanonicalSnapshotResult {
  return buildCandidateSnapshotFromCanonicalEvidence(
    [
      baseRow({
        id: "creator",
        external_evidence_id: "lead:creator",
        evidence_class: "transcript",
        claim_text: "Creator interpretation awaiting corroboration.",
        source: source({
          source_type: "video",
          source_name: "StockedUp",
          source_tier: 5,
        }),
      }),
    ],
    {
      asOf: AS_OF,
    },
  );
}

test("Task 9 manual mode stays read-only when Dossier V2 persistence is not deployed", async () => {
  let modelCalls = 0;
  const failingRunner: ModelRunner = async () => {
    modelCalls += 1;
    throw new Error("forced dry-run model failure");
  };

  const result = await runManualDossierV2({
    asOf: AS_OF,
    client: missingDossierTableClient(),
    snapshotResult: leadOnlySnapshot(),
    researchBrainOptions: {
      modelRunner: failingRunner,
    },
  });

  assert.equal(result.mode, "dry_run");
  assert.equal(result.persistence_available, false);
  assert.equal(result.previous_dossier_id, null);
  assert.equal(modelCalls, 1);
  assert.equal(result.analytical_output.diagnostics.degraded, true);
  assert.equal(result.packet.research_leads.length, 1);
  assert.equal(result.packet.observed_evidence.length, 0);
});

test("Task 9 persist mode fails closed when the production Dossier V2 table is absent", async () => {
  await assert.rejects(
    async () => {
      await runManualDossierV2({
        asOf: AS_OF,
        persist: true,
        client: missingDossierTableClient(),
        snapshotResult: leadOnlySnapshot(),
      });
    },
    /market_dossiers_v2 is not deployed/,
  );
});
