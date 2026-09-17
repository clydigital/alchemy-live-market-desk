import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  assembleDossierV2InputPacket,
  toCanonicalJson,
  INPUT_PACKET_CONTRACT_VERSION,
  THESIS_LEDGER_CONTRACT_VERSION,
  type DossierV2InputRequest,
  type CandidateSnapshot,
  type ThesisLedger,
} from "../lib/dossier-v2/input-packet.ts";

const TEST_AS_OF = "2026-03-31T12:00:00.000Z";
const IN_WINDOW_TIME = "2026-03-31T08:00:00.000Z";
const BOUNDARY_24H_TIME = "2026-03-30T12:00:00.000Z"; // exact 24h prior
const OUT_OF_WINDOW_TIME = "2026-03-30T11:59:59.000Z"; // 24h + 1ms prior
const FUTURE_TIME = "2026-03-31T12:00:01.000Z"; // 1ms into future

const SAMPLE_THESIS_LEDGER: ThesisLedger = {
  contract_version: THESIS_LEDGER_CONTRACT_VERSION,
  entries: [
    {
      thesis_id: "thesis:101",
      contract_version: THESIS_LEDGER_CONTRACT_VERSION,
      title: "Tech Capex Expansion",
      statement: "Hyperscalers maintain elevated AI infrastructure spend.",
      state: "confirmed",
      version: 2,
      created_at: "2026-03-01T00:00:00.000Z",
      updated_at: "2026-03-30T00:00:00.000Z",
      lineage: ["thesis:101-v1"],
      arguments: [
        { arg_id: "arg:1", type: "supporting", text: "Q1 guide upgraded" },
      ],
    },
  ],
};

test("1. valid first-run packet & prior dossier identity enforcement", () => {
  const request: DossierV2InputRequest = {
    contract_version: INPUT_PACKET_CONTRACT_VERSION,
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  };

  const snapshot: CandidateSnapshot = {
    observed_evidence: [
      {
        claim_or_fact: "NVDA reported 15% sequential Q1 revenue growth.",
        available_at: IN_WINDOW_TIME,
        grouping_key: "nvda-q1-rev",
        source_type: "SEC_FILING",
        provenance: [{ source_type: "SEC_FILING", source_id: "10k-001" }],
      },
    ],
  };

  const packet = assembleDossierV2InputPacket(request, snapshot);

  assert.equal(packet.contract_version, INPUT_PACKET_CONTRACT_VERSION);
  assert.equal(packet.as_of, TEST_AS_OF);
  assert.equal(packet.previous_dossier_id, null);
  assert.equal(packet.observed_evidence.length, 1);
  assert.equal(packet.observed_evidence[0].epistemic_label, "OBSERVED");
  assert.equal(packet.prior_analytical_state.previous_dossier_id, null);
  assert.ok(packet.packet_id);

  // Test 1a: null previous_dossier_id with supplied previous_dossier state must throw
  assert.throws(() => {
    assembleDossierV2InputPacket(
      {
        as_of: TEST_AS_OF,
        previous_dossier_id: null,
        previous_dossier: {
          id: "00000000-0000-4000-a000-000000000001",
          as_of: "2026-03-30T12:00:00.000Z",
        },
      },
      snapshot,
    );
  }, /previous_dossier state supplied when previous_dossier_id is null/);

  // Test 1b: ID mismatch between previous_dossier_id and previous_dossier.id must throw
  assert.throws(() => {
    assembleDossierV2InputPacket(
      {
        as_of: TEST_AS_OF,
        previous_dossier_id: "00000000-0000-4000-a000-000000000001",
        previous_dossier: {
          id: "00000000-0000-4000-a000-000000000002",
          as_of: "2026-03-30T12:00:00.000Z",
        },
      },
      snapshot,
    );
  }, /does not match previous_dossier_id/);

  // Test 1c: future-dated prior dossier relative to request as_of must throw
  assert.throws(() => {
    assembleDossierV2InputPacket(
      {
        as_of: TEST_AS_OF,
        previous_dossier_id: "00000000-0000-4000-a000-000000000001",
        previous_dossier: {
          id: "00000000-0000-4000-a000-000000000001",
          as_of: "2026-03-31T12:00:01.000Z", // future
        },
      },
      snapshot,
    );
  }, /future-dated relative to request as_of/);
});

test("2. optional-source failures remain non-blocking", () => {
  const request: DossierV2InputRequest = {
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  };

  const snapshot: CandidateSnapshot = {
    price_data: { status: "FAILED" },
    macro_data: { status: "MISSING" },
    sources_status: {
      news_wire: { status: "STALE", message: "News feed offline" },
    },
  };

  const packet = assembleDossierV2InputPacket(request, snapshot);

  assert.ok(packet.packet_id);
  assert.equal(packet.freshness_warnings.length, 1);
  assert.equal(packet.freshness_warnings[0].source_name, "news_wire");
  assert.equal(packet.research_gaps.length, 2);
  const gapCategories = packet.research_gaps.map((g) => g.category);
  assert.ok(gapCategories.includes("PRICE_DATA"));
  assert.ok(gapCategories.includes("MACRO_DATA"));
});

test("3. equivalent shuffled inputs produce identical output and packet ID", () => {
  const request1: DossierV2InputRequest = {
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  };

  const snapshot1: CandidateSnapshot = {
    observed_evidence: [
      {
        claim_or_fact: "Fact Alpha",
        available_at: IN_WINDOW_TIME,
        grouping_key: "grp-1",
        rank: 1,
        source_type: "SEC_FILING",
        provenance: [
          { source_type: "SEC", source_id: "sec-a", url: "https://sec.gov/a" },
          { source_type: "SEC", source_id: "sec-b", url: "https://sec.gov/b" },
        ],
      },
      {
        claim_or_fact: "Fact Beta",
        available_at: IN_WINDOW_TIME,
        grouping_key: "grp-2",
        rank: 2,
        source_type: "SEC_FILING",
        provenance: [{ source_type: "SEC", source_id: "sec-c" }],
      },
    ],
    research_leads: [
      { claim_or_question: "Question One?", available_at: IN_WINDOW_TIME, grouping_key: "grp-1", rank: 1, provenance: [{ source_type: "LEAD", source_id: "l1" }] },
      { claim_or_question: "Question Two?", available_at: IN_WINDOW_TIME, grouping_key: "grp-2", rank: 2, provenance: [{ source_type: "LEAD", source_id: "l2" }] },
    ],
  };

  const request2: DossierV2InputRequest = {
    previous_dossier_id: null,
    as_of: TEST_AS_OF,
  };

  // Snapshot with reversed order and shuffled provenance refs
  const snapshot2: CandidateSnapshot = {
    research_leads: [
      { claim_or_question: "Question Two?", available_at: IN_WINDOW_TIME, grouping_key: "grp-2", rank: 2, provenance: [{ source_type: "LEAD", source_id: "l2" }] },
      { claim_or_question: "Question One?", available_at: IN_WINDOW_TIME, grouping_key: "grp-1", rank: 1, provenance: [{ source_type: "LEAD", source_id: "l1" }] },
    ],
    observed_evidence: [
      {
        claim_or_fact: "Fact Beta",
        available_at: IN_WINDOW_TIME,
        grouping_key: "grp-2",
        rank: 2,
        source_type: "SEC_FILING",
        provenance: [{ source_type: "SEC", source_id: "sec-c" }],
      },
      {
        claim_or_fact: "Fact Alpha",
        available_at: IN_WINDOW_TIME,
        grouping_key: "grp-1",
        rank: 1,
        source_type: "SEC_FILING",
        provenance: [
          { source_type: "SEC", source_id: "sec-b", url: "https://sec.gov/b" },
          { source_type: "SEC", source_id: "sec-a", url: "https://sec.gov/a" },
        ],
      },
    ],
  };

  const packet1 = assembleDossierV2InputPacket(request1, snapshot1);
  const packet2 = assembleDossierV2InputPacket(request2, snapshot2);

  assert.equal(packet1.packet_id, packet2.packet_id);
  assert.equal(toCanonicalJson(packet1), toCanonicalJson(packet2));
});

test("4. input arguments remain unchanged", () => {
  const request: DossierV2InputRequest = Object.freeze({
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  });

  const rawEvidence = [
    Object.freeze({
      claim_or_fact: "Fact Gamma",
      available_at: IN_WINDOW_TIME,
      grouping_key: "grp-3",
      source_type: "SEC_FILING",
      provenance: [Object.freeze({ source_type: "SEC", source_id: "s1" })],
    }),
  ];

  const snapshot: CandidateSnapshot = Object.freeze({
    observed_evidence: rawEvidence as unknown as CandidateSnapshot["observed_evidence"],
  });

  const cloneReq = JSON.stringify(request);
  const cloneSnap = JSON.stringify(snapshot);

  assembleDossierV2InputPacket(request, snapshot);

  assert.equal(JSON.stringify(request), cloneReq);
  assert.equal(JSON.stringify(snapshot), cloneSnap);
});

test("5. available_at > as_of cannot leak into the packet", () => {
  const request: DossierV2InputRequest = {
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  };

  const snapshot: CandidateSnapshot = {
    observed_evidence: [
      { claim_or_fact: "Future Fact", available_at: FUTURE_TIME, grouping_key: "future-grp", source_type: "SEC_FILING", provenance: [{ source_type: "SEC", source_id: "s1" }] },
    ],
    research_leads: [
      { claim_or_question: "Future Question?", available_at: FUTURE_TIME, grouping_key: "future-grp", provenance: [{ source_type: "LEAD", source_id: "l1" }] },
    ],
  };

  const packet = assembleDossierV2InputPacket(request, snapshot);

  assert.equal(packet.observed_evidence.length, 0);
  assert.equal(packet.research_leads.length, 0);
  assert.equal(packet.diagnostics.omitted_evidence_count, 1);
  assert.equal(packet.diagnostics.omitted_leads_count, 1);
});

test("6. exact 24-hour boundary behaviour for evidence", () => {
  const request: DossierV2InputRequest = {
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  };

  const snapshot: CandidateSnapshot = {
    observed_evidence: [
      { claim_or_fact: "In Window Fact", available_at: IN_WINDOW_TIME, grouping_key: "in-grp", source_type: "SEC_FILING", provenance: [{ source_type: "SEC", source_id: "s1" }] },
      { claim_or_fact: "Boundary Fact", available_at: BOUNDARY_24H_TIME, grouping_key: "bound-grp", source_type: "SEC_FILING", provenance: [{ source_type: "SEC", source_id: "s2" }] },
      { claim_or_fact: "Out of Window Fact", available_at: OUT_OF_WINDOW_TIME, grouping_key: "out-grp", source_type: "SEC_FILING", provenance: [{ source_type: "SEC", source_id: "s3" }] },
    ],
  };

  const packet = assembleDossierV2InputPacket(request, snapshot);

  const facts = packet.observed_evidence.map((e) => e.claim_or_fact);
  assert.ok(facts.includes("In Window Fact"));
  assert.ok(facts.includes("Boundary Fact"));
  assert.ok(!facts.includes("Out of Window Fact"));
  assert.equal(packet.diagnostics.omitted_evidence_count, 1);
});

test("7. evidence may only be OBSERVED", () => {
  const request: DossierV2InputRequest = {
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  };

  const snapshot: CandidateSnapshot = {
    observed_evidence: [
      { claim_or_fact: "Fact Delta", available_at: IN_WINDOW_TIME, grouping_key: "grp-4", epistemic_label: "SUPPORTED", source_type: "SEC_FILING", provenance: [{ source_type: "SEC", source_id: "s1" }] },
    ],
  };

  const packet = assembleDossierV2InputPacket(request, snapshot);

  assert.equal(packet.observed_evidence.length, 1);
  assert.equal(packet.observed_evidence[0].epistemic_label, "OBSERVED");
});

test("8. leads cannot carry analytical labels", () => {
  const request: DossierV2InputRequest = {
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  };

  const snapshot: CandidateSnapshot = {
    research_leads: [
      { claim_or_question: "Will guidance hold?", available_at: IN_WINDOW_TIME, grouping_key: "grp-5", epistemic_label: "SPECULATIVE", provenance: [{ source_type: "LEAD", source_id: "l1" }] },
    ],
  };

  const packet = assembleDossierV2InputPacket(request, snapshot);

  assert.equal(packet.research_leads.length, 1);
  assert.equal(packet.research_leads[0].epistemic_label, undefined);
});

test("9. prior analytical labels remain isolated to prior state", () => {
  const prevId = "00000000-0000-4000-a000-000000000001";
  const request: DossierV2InputRequest = {
    as_of: TEST_AS_OF,
    previous_dossier_id: prevId,
    previous_dossier: {
      id: prevId,
      as_of: "2026-03-30T12:00:00.000Z",
      prior_claims: [
        {
          claim_id: "pc:1",
          epistemic_label: "INFERRED",
          claim_text: "Margin pressure likely in Q2",
          dossier_id: prevId,
          as_of: "2026-03-30T12:00:00.000Z",
          provenance: [],
        },
        {
          claim_id: "pc:2",
          epistemic_label: "SPECULATIVE",
          claim_text: "Potential M&A in semiconductor segment",
          dossier_id: prevId,
          as_of: "2026-03-30T12:00:00.000Z",
          provenance: [],
        },
      ],
    },
  };

  const snapshot: CandidateSnapshot = {
    observed_evidence: [
      { claim_or_fact: "Q1 revenue $10B", available_at: IN_WINDOW_TIME, grouping_key: "grp-6", source_type: "SEC_FILING", provenance: [{ source_type: "SEC", source_id: "s1" }] },
    ],
  };

  const packet = assembleDossierV2InputPacket(request, snapshot);

  assert.equal(packet.observed_evidence.length, 1);
  assert.equal(packet.observed_evidence[0].epistemic_label, "OBSERVED");

  assert.equal(packet.prior_analytical_state.prior_claims.length, 2);
  assert.equal(packet.prior_analytical_state.prior_claims[0].epistemic_label, "INFERRED");
  assert.equal(packet.prior_analytical_state.prior_claims[1].epistemic_label, "SPECULATIVE");
});

test("10. exact dedupe works and merges provenance", () => {
  const request: DossierV2InputRequest = {
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  };

  const snapshot: CandidateSnapshot = {
    observed_evidence: [
      {
        claim_or_fact: "Fed holds benchmark rate unchanged",
        available_at: IN_WINDOW_TIME,
        grouping_key: "fed-rate",
        source_type: "PRESS_RELEASE",
        provenance: [{ source_type: "REUTERS", source_id: "ret-1" }],
      },
      {
        claim_or_fact: "fed holds benchmark rate unchanged", // casing difference
        available_at: IN_WINDOW_TIME,
        grouping_key: "fed-rate",
        source_type: "PRESS_RELEASE",
        provenance: [{ source_type: "BLOOMBERG", source_id: "bb-1" }],
      },
    ],
  };

  const packet = assembleDossierV2InputPacket(request, snapshot);

  assert.equal(packet.observed_evidence.length, 1);
  assert.equal(packet.observed_evidence[0].provenance.length, 2);
  const provSources = packet.observed_evidence[0].provenance.map((p) => p.source_type);
  assert.ok(provSources.includes("REUTERS"));
  assert.ok(provSources.includes("BLOOMBERG"));
});

test("11. explicit conflict key produces conflict group; distinct non-conflicting facts share cluster without conflict ID", () => {
  const request: DossierV2InputRequest = {
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  };

  const snapshot: CandidateSnapshot = {
    observed_evidence: [
      // Complementary facts under same grouping_key without conflict_key
      { claim_or_fact: "Q1 Revenue $10B", available_at: IN_WINDOW_TIME, grouping_key: "q1-results", source_type: "SEC_FILING", provenance: [{ source_type: "SEC", source_id: "1" }] },
      { claim_or_fact: "Q1 Net Income $2B", available_at: IN_WINDOW_TIME, grouping_key: "q1-results", source_type: "SEC_FILING", provenance: [{ source_type: "SEC", source_id: "1" }] },

      // Explicitly conflicting facts under same grouping_key with matching conflict_key
      { claim_or_fact: "Q1 CPI rose 0.3%", available_at: IN_WINDOW_TIME, grouping_key: "cpi-q1", conflict_key: "cpi-rate", source_type: "STATISTICAL_AGENCY", provenance: [{ source_type: "BLS", source_id: "1" }] },
      { claim_or_fact: "Q1 CPI rose 0.4%", available_at: IN_WINDOW_TIME, grouping_key: "cpi-q1", conflict_key: "cpi-rate", source_type: "STATISTICAL_AGENCY", provenance: [{ source_type: "BLS", source_id: "2" }] },
    ],
  };

  const packet = assembleDossierV2InputPacket(request, snapshot);

  // Complementary facts: retain cluster membership, NO conflict_group_id
  const q1Fact1 = packet.observed_evidence.find((e) => e.claim_or_fact === "Q1 Revenue $10B");
  const q1Fact2 = packet.observed_evidence.find((e) => e.claim_or_fact === "Q1 Net Income $2B");
  assert.ok(q1Fact1 && q1Fact2);
  assert.equal(q1Fact1.conflict_group_id, undefined);
  assert.equal(q1Fact2.conflict_group_id, undefined);

  // Explicit conflicting facts: share deterministic conflict_group_id
  const cpi1 = packet.observed_evidence.find((e) => e.claim_or_fact === "Q1 CPI rose 0.3%");
  const cpi2 = packet.observed_evidence.find((e) => e.claim_or_fact === "Q1 CPI rose 0.4%");
  assert.ok(cpi1 && cpi2);
  assert.ok(cpi1.conflict_group_id);
  assert.equal(cpi1.conflict_group_id, cpi2.conflict_group_id);
});

test("12. real deterministic supersession chain and future-dated supersession filtering", () => {
  const request: DossierV2InputRequest = {
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  };

  const snapshot: CandidateSnapshot = {
    observed_evidence: [
      {
        evidence_id: "ev:initial-gdp",
        claim_or_fact: "Preliminary Q1 GDP 2.1%",
        available_at: "2026-03-31T06:00:00.000Z",
        grouping_key: "gdp-q1",
        source_type: "STATISTICAL_AGENCY",
        provenance: [{ source_type: "BEA", source_id: "gdp-v1" }],
      },
      {
        evidence_id: "ev:revised-gdp",
        claim_or_fact: "Revised Q1 GDP 2.3%",
        available_at: "2026-03-31T10:00:00.000Z",
        grouping_key: "gdp-q1",
        supersedes_evidence_id: "ev:initial-gdp",
        source_type: "STATISTICAL_AGENCY",
        provenance: [{ source_type: "BEA", source_id: "gdp-v2" }],
      },
      {
        evidence_id: "ev:future-gdp-leak",
        claim_or_fact: "Leaked Final Q1 GDP 2.4%",
        available_at: FUTURE_TIME, // Future-dated, must be filtered out
        grouping_key: "gdp-q1",
        supersedes_evidence_id: "ev:revised-gdp",
        source_type: "STATISTICAL_AGENCY",
        provenance: [{ source_type: "BEA", source_id: "gdp-v3" }],
      },
    ],
  };

  const packet = assembleDossierV2InputPacket(request, snapshot);

  // Future leak filtered out
  assert.equal(packet.observed_evidence.find((e) => e.evidence_id === "ev:future-gdp-leak"), undefined);

  // ev:initial-gdp suppressed by ev:revised-gdp
  assert.equal(packet.observed_evidence.find((e) => e.evidence_id === "ev:initial-gdp"), undefined);

  const selected = packet.observed_evidence.find((e) => e.evidence_id === "ev:revised-gdp");
  assert.ok(selected);
  assert.deepEqual(selected.superseded_evidence_ids, ["ev:initial-gdp"]);
  assert.equal(selected.conflict_group_id, undefined); // Supersession is NOT a conflict
});

test("13. zero creator transcripts is valid", () => {
  const request: DossierV2InputRequest = {
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  };

  const snapshot: CandidateSnapshot = {
    creator_themes: [],
  };

  const packet = assembleDossierV2InputPacket(request, snapshot);

  assert.equal(packet.creator_themes.length, 0);
  assert.ok(packet.packet_id);
});

test("14. creator caps are enforced", () => {
  const request: DossierV2InputRequest = {
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  };

  const snapshot: CandidateSnapshot = {
    creator_themes: [
      {
        theme_name: "Theme 1",
        expand_later: true,
        claims: Array.from({ length: 5 }, (_, i) => ({ text: `Claim 1.${i}`, available_at: IN_WINDOW_TIME, provenance: [{ source_type: "YOUTUBE", source_id: "c1" }] })),
      },
      {
        theme_name: "Theme 2",
        expand_later: true,
        claims: Array.from({ length: 2 }, (_, i) => ({ text: `Claim 2.${i}`, available_at: IN_WINDOW_TIME, provenance: [{ source_type: "YOUTUBE", source_id: "c2" }] })),
      },
      {
        theme_name: "Theme 3",
        expand_later: true, // Should be demoted (max 2 expand_later)
        claims: Array.from({ length: 2 }, (_, i) => ({ text: `Claim 3.${i}`, available_at: IN_WINDOW_TIME, provenance: [{ source_type: "YOUTUBE", source_id: "c3" }] })),
      },
    ],
  };

  const packet = assembleDossierV2InputPacket(request, snapshot);

  assert.equal(packet.creator_themes[0].claims.length, 3); // capped at 3 claims
  const expandCount = packet.creator_themes.filter((t) => t.expand_later).length;
  assert.equal(expandCount, 2); // max 2 expand_later
  assert.equal(packet.diagnostics.omitted_creator_claims_count, 2);
});

test("15. strengthened evidence admission rules prevent transcript/creator/discovery material promotion to OBSERVED", () => {
  const request: DossierV2InputRequest = {
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  };

  const snapshot: CandidateSnapshot = {
    observed_evidence: [
      {
        claim_or_fact: "Creator YouTube opinion on rate cuts",
        available_at: IN_WINDOW_TIME,
        grouping_key: "creator-opinion",
        source_type: "TRANSCRIPT", // Forbidden as observed evidence
        provenance: [{ source_type: "YOUTUBE", source_id: "vid-123" }],
      },
      {
        claim_or_fact: "Research synthesis on tech AI spending",
        available_at: IN_WINDOW_TIME,
        grouping_key: "ai-synth",
        source_type: "RESEARCH_ANALYSIS", // Forbidden as observed evidence
        provenance: [{ source_type: "MODEL", source_id: "synth-1" }],
      },
      {
        claim_or_fact: "Official SEC filing 10-Q revenue",
        available_at: IN_WINDOW_TIME,
        grouping_key: "sec-rev",
        source_type: "SEC_FILING", // Allowed factual evidence
        provenance: [{ source_type: "SEC", source_id: "10q-99" }],
      },
    ],
  };

  const packet = assembleDossierV2InputPacket(request, snapshot);

  assert.equal(packet.observed_evidence.length, 1);
  assert.equal(packet.observed_evidence[0].claim_or_fact, "Official SEC filing 10-Q revenue");
  assert.equal(packet.observed_evidence[0].epistemic_label, "OBSERVED");
});

test("16. provenance references remain valid and bounded", () => {
  const request: DossierV2InputRequest = {
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  };

  const rawProv = Array.from({ length: 10 }, (_, i) => ({
    source_type: "PRESS_RELEASE",
    source_id: `src-${i}`,
    url: `https://example.com/item-${i}`,
  }));

  const snapshot: CandidateSnapshot = {
    observed_evidence: [
      { claim_or_fact: "Many prov sources", available_at: IN_WINDOW_TIME, grouping_key: "prov-grp", source_type: "PRESS_RELEASE", provenance: rawProv },
    ],
  };

  const packet = assembleDossierV2InputPacket(request, snapshot);

  assert.equal(packet.observed_evidence[0].provenance.length, 5); // max 5 provenance refs
});

test("17. forward-looking catalyst window & missing event_time rejection", () => {
  const request: DossierV2InputRequest = {
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  };

  const snapshot: CandidateSnapshot = {
    catalysts: [
      {
        title: "FOMC Rate Decision",
        available_at: "2026-03-29T12:00:00.000Z", // verified 48h prior to as_of
        event_time: "2026-04-03T18:00:00.000Z", // occurs 3 days after as_of
        provenance: [{ source_type: "FED_CALENDAR", source_id: "fomc-01" }],
      },
      {
        title: "CPI Release",
        available_at: IN_WINDOW_TIME,
        event_time: "2026-04-01T12:30:00.000Z", // occurs 1 day after as_of (earlier)
        provenance: [{ source_type: "BLS_CALENDAR", source_id: "cpi-01" }],
      },
      {
        title: "Malformed Catalyst without event_time",
        available_at: IN_WINDOW_TIME,
        // missing event_time - must be omitted!
        provenance: [{ source_type: "CALENDAR", source_id: "bad-1" }],
      },
    ],
  };

  const packet = assembleDossierV2InputPacket(request, snapshot);

  assert.equal(packet.catalysts.length, 2);
  // Earlier event (CPI) should be ordered first
  assert.equal(packet.catalysts[0].title, "CPI Release");
  assert.equal(packet.catalysts[1].title, "FOMC Rate Decision");
});

test("18. final canonical output respects strict byte ceiling under oversized text", () => {
  const request: DossierV2InputRequest = {
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  };

  const largeLeads: CandidateSnapshot["research_leads"] = [];
  for (let c = 0; c < 10; c++) {
    for (let l = 0; l < 3; l++) {
      largeLeads.push({
        claim_or_question: `Cluster ${c} Lead ${l} ` + "X".repeat(10000),
        available_at: IN_WINDOW_TIME,
        grouping_key: `cluster-key-${c}`,
        rank: l + 1,
        provenance: [{ source_type: "LEAD", source_id: "l1" }],
      });
    }
  }

  const snapshot: CandidateSnapshot = {
    research_leads: largeLeads,
  };

  const packet = assembleDossierV2InputPacket(request, snapshot);

  const jsonStr = toCanonicalJson(packet);
  const byteLen = Buffer.byteLength(jsonStr, "utf8");

  assert.ok(byteLen <= 200000);
  assert.equal(packet.diagnostics.byte_limit_truncation_applied, true);
});

test("19. Thesis Ledger input is preserved/validated but never analytically transitioned", () => {
  const request: DossierV2InputRequest = {
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  };

  const snapshot: CandidateSnapshot = {
    thesis_ledger: SAMPLE_THESIS_LEDGER,
  };

  const packet = assembleDossierV2InputPacket(request, snapshot);

  assert.ok(packet.thesis_ledger);
  assert.equal(packet.thesis_ledger.entries.length, 1);
  const entry = packet.thesis_ledger.entries[0];
  assert.equal(entry.thesis_id, "thesis:101");
  assert.equal(entry.state, "confirmed"); // Unchanged
  assert.equal(entry.version, 2); // Unchanged
  assert.deepEqual(entry.lineage, ["thesis:101-v1"]); // Unchanged
});

test("20. source inspection confirms no forbidden runtime/model/Hybrid/Story/scheduling/publication imports", () => {
  const filePath = path.join(process.cwd(), "lib/dossier-v2/input-packet.ts");
  const content = fs.readFileSync(filePath, "utf8");

  const forbiddenTerms = [
    "openai",
    "lib/intelligence/runtime",
    "MarketBelief",
    "divergence",
    "hypothesis",
    "challenger",
    "scenario",
    "hybrid-publication",
    "story",
    "publication",
    "transcript-worker",
    "cron-research",
  ];

  for (const term of forbiddenTerms) {
    const regex = new RegExp(`import.*${term}`, "i");
    assert.equal(regex.test(content), false, `Forbidden import found in source file: ${term}`);
  }
});
