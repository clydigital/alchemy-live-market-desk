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

test("3. equivalent shuffled inputs produce identical output and packet ID across all collections", () => {
  const request1: DossierV2InputRequest = {
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  };

  const ledger1: ThesisLedger = {
    contract_version: THESIS_LEDGER_CONTRACT_VERSION,
    entries: [
      {
        thesis_id: "thesis:B",
        contract_version: THESIS_LEDGER_CONTRACT_VERSION,
        title: "Title B",
        statement: "Stmt B",
        state: "unresolved",
        version: 1,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
        lineage: [],
        arguments: [
          { arg_id: "arg:2", type: "counter", text: "Text 2" },
          { arg_id: "arg:1", type: "supporting", text: "Text 1" },
        ],
      },
      {
        thesis_id: "thesis:A",
        contract_version: THESIS_LEDGER_CONTRACT_VERSION,
        title: "Title A",
        statement: "Stmt A",
        state: "confirmed",
        version: 1,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
        lineage: [],
      },
    ],
  };

  const snapshot1: CandidateSnapshot = {
    thesis_ledger: ledger1,
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
    ],
  };

  const ledger2: ThesisLedger = {
    contract_version: THESIS_LEDGER_CONTRACT_VERSION,
    entries: [
      {
        thesis_id: "thesis:A",
        contract_version: THESIS_LEDGER_CONTRACT_VERSION,
        title: "Title A",
        statement: "Stmt A",
        state: "confirmed",
        version: 1,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
        lineage: [],
      },
      {
        thesis_id: "thesis:B",
        contract_version: THESIS_LEDGER_CONTRACT_VERSION,
        title: "Title B",
        statement: "Stmt B",
        state: "unresolved",
        version: 1,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
        lineage: [],
        arguments: [
          { arg_id: "arg:1", type: "supporting", text: "Text 1" },
          { arg_id: "arg:2", type: "counter", text: "Text 2" },
        ],
      },
    ],
  };

  const snapshot2: CandidateSnapshot = {
    thesis_ledger: ledger2,
    observed_evidence: [
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
  const packet2 = assembleDossierV2InputPacket(request1, snapshot2);

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
      { claim_or_fact: "Q1 Revenue $10B", available_at: IN_WINDOW_TIME, grouping_key: "q1-results", source_type: "SEC_FILING", provenance: [{ source_type: "SEC", source_id: "1" }] },
      { claim_or_fact: "Q1 Net Income $2B", available_at: IN_WINDOW_TIME, grouping_key: "q1-results", source_type: "SEC_FILING", provenance: [{ source_type: "SEC", source_id: "1" }] },
      { claim_or_fact: "Q1 CPI rose 0.3%", available_at: IN_WINDOW_TIME, grouping_key: "cpi-q1", conflict_key: "cpi-rate", source_type: "STATISTICAL_AGENCY", provenance: [{ source_type: "BLS", source_id: "1" }] },
      { claim_or_fact: "Q1 CPI rose 0.4%", available_at: IN_WINDOW_TIME, grouping_key: "cpi-q1", conflict_key: "cpi-rate", source_type: "STATISTICAL_AGENCY", provenance: [{ source_type: "BLS", source_id: "2" }] },
    ],
  };

  const packet = assembleDossierV2InputPacket(request, snapshot);

  const q1Fact1 = packet.observed_evidence.find((e) => e.claim_or_fact === "Q1 Revenue $10B");
  const q1Fact2 = packet.observed_evidence.find((e) => e.claim_or_fact === "Q1 Net Income $2B");
  assert.ok(q1Fact1 && q1Fact2);
  assert.equal(q1Fact1.conflict_group_id, undefined);
  assert.equal(q1Fact2.conflict_group_id, undefined);

  const cpi1 = packet.observed_evidence.find((e) => e.claim_or_fact === "Q1 CPI rose 0.3%");
  const cpi2 = packet.observed_evidence.find((e) => e.claim_or_fact === "Q1 CPI rose 0.4%");
  assert.ok(cpi1 && cpi2);
  assert.ok(cpi1.conflict_group_id);
  assert.equal(cpi1.conflict_group_id, cpi2.conflict_group_id);
});

test("12. transitive supersession lineage chains and cycle detection", () => {
  const request: DossierV2InputRequest = {
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  };

  const snapshotChain: CandidateSnapshot = {
    observed_evidence: [
      {
        evidence_id: "ev:version-A",
        claim_or_fact: "Preliminary Q1 GDP 2.1%",
        available_at: "2026-03-31T06:00:00.000Z",
        grouping_key: "gdp-q1",
        source_type: "STATISTICAL_AGENCY",
        provenance: [{ source_type: "BEA", source_id: "v1" }],
      },
      {
        evidence_id: "ev:version-B",
        claim_or_fact: "Revised Q1 GDP 2.3%",
        available_at: "2026-03-31T08:00:00.000Z",
        grouping_key: "gdp-q1",
        supersedes_evidence_id: "ev:version-A",
        source_type: "STATISTICAL_AGENCY",
        provenance: [{ source_type: "BEA", source_id: "v2" }],
      },
      {
        evidence_id: "ev:version-C",
        claim_or_fact: "Final Q1 GDP 2.4%",
        available_at: "2026-03-31T10:00:00.000Z",
        grouping_key: "gdp-q1",
        supersedes_evidence_id: "ev:version-B",
        source_type: "STATISTICAL_AGENCY",
        provenance: [{ source_type: "BEA", source_id: "v3" }],
      },
    ],
  };

  const packetChain = assembleDossierV2InputPacket(request, snapshotChain);
  assert.equal(packetChain.observed_evidence.length, 1);
  const surviving = packetChain.observed_evidence[0];
  assert.equal(surviving.evidence_id, "ev:version-C");
  assert.deepEqual(surviving.superseded_evidence_ids, ["ev:version-A", "ev:version-B"]);

  const snapshotCycles: CandidateSnapshot = {
    observed_evidence: [
      {
        evidence_id: "ev:cycle-X",
        claim_or_fact: "Fact X with self cycle",
        available_at: IN_WINDOW_TIME,
        grouping_key: "cycle-grp",
        supersedes_evidence_id: "ev:cycle-X", // Self cycle
        source_type: "SEC_FILING",
        provenance: [{ source_type: "SEC", source_id: "s1" }],
      },
      {
        evidence_id: "ev:cycle-Y",
        claim_or_fact: "Fact Y in 2-node cycle",
        available_at: IN_WINDOW_TIME,
        grouping_key: "cycle-grp2",
        supersedes_evidence_id: "ev:cycle-Z",
        source_type: "SEC_FILING",
        provenance: [{ source_type: "SEC", source_id: "s2" }],
      },
      {
        evidence_id: "ev:cycle-Z",
        claim_or_fact: "Fact Z in 2-node cycle",
        available_at: IN_WINDOW_TIME,
        grouping_key: "cycle-grp2",
        supersedes_evidence_id: "ev:cycle-Y", // 2-node cycle with Y
        source_type: "SEC_FILING",
        provenance: [{ source_type: "SEC", source_id: "s3" }],
      },
    ],
  };

  const packetCycles = assembleDossierV2InputPacket(request, snapshotCycles);
  assert.equal(packetCycles.observed_evidence.length, 3);
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

test("15. reported-evidence admission restrictions (NEWS_WIRE uncorroborated vs corroborated) and firewall", () => {
  const request: DossierV2InputRequest = {
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  };

  const snapshot: CandidateSnapshot = {
    observed_evidence: [
      {
        claim_or_fact: "Ordinary un-corroborated news wire report",
        available_at: IN_WINDOW_TIME,
        grouping_key: "wire-1",
        source_type: "NEWS_WIRE",
        provenance: [{ source_type: "REUTERS", source_id: "w1" }],
      },
      {
        claim_or_fact: "Corroborated news wire report with ancestry count 2",
        available_at: IN_WINDOW_TIME,
        grouping_key: "wire-2",
        source_type: "NEWS_WIRE",
        independent_ancestry_count: 2, // Admissible
        provenance: [{ source_type: "REUTERS", source_id: "w2" }],
      },
      {
        claim_or_fact: "Explicitly pre-admitted news wire report",
        available_at: IN_WINDOW_TIME,
        grouping_key: "wire-3",
        source_type: "NEWS_WIRE",
        is_admitted_fact: true, // Admissible
        provenance: [{ source_type: "AP", source_id: "w3" }],
      },
      {
        claim_or_fact: "YouTube transcript material trying to bypass firewall",
        available_at: IN_WINDOW_TIME,
        grouping_key: "creator-bypass",
        source_type: "TRANSCRIPT",
        is_admitted_fact: true, // Forbidden source type MUST stay blocked
        provenance: [{ source_type: "YOUTUBE", source_id: "vid-99" }],
      },
    ],
  };

  const packet = assembleDossierV2InputPacket(request, snapshot);

  const facts = packet.observed_evidence.map((e) => e.claim_or_fact);
  assert.equal(packet.observed_evidence.length, 2);
  assert.ok(!facts.includes("Ordinary un-corroborated news wire report"));
  assert.ok(facts.includes("Corroborated news wire report with ancestry count 2"));
  assert.ok(facts.includes("Explicitly pre-admitted news wire report"));
  assert.ok(!facts.includes("YouTube transcript material trying to bypass firewall"));
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
        provenance: [{ source_type: "CALENDAR", source_id: "bad-1" }],
      },
    ],
  };

  const packet = assembleDossierV2InputPacket(request, snapshot);

  assert.equal(packet.catalysts.length, 2);
  assert.equal(packet.catalysts[0].title, "CPI Release");
  assert.equal(packet.catalysts[1].title, "FOMC Rate Decision");
});

test("18. graceful non-fatal 200,000-byte reduction for oversized Thesis title, oversized provenance URL/title/locator, and oversized research-gap/freshness text", () => {
  const request: DossierV2InputRequest = {
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  };

  const hugeLedger: ThesisLedger = {
    contract_version: THESIS_LEDGER_CONTRACT_VERSION,
    entries: [
      {
        thesis_id: "thesis:huge-1",
        contract_version: THESIS_LEDGER_CONTRACT_VERSION,
        title: "Huge Thesis Title ".repeat(1000), // Oversized title
        statement: "S".repeat(150000), // Oversized statement
        state: "confirmed",
        version: 1,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
        lineage: [],
        arguments: [
          { arg_id: "arg:huge-1", type: "supporting", text: "A".repeat(50000) }, // Oversized argument
        ],
      },
    ],
  };

  const hugeProvenance = [
    {
      source_type: "SEC_FILING",
      source_id: "sec-001",
      url: "https://example.com/oversized-url/" + "U".repeat(10000),
      title: "Oversized Provenance Title " + "T".repeat(10000),
      locator: "Oversized Locator " + "L".repeat(10000),
    },
  ];

  const snapshot: CandidateSnapshot = {
    thesis_ledger: hugeLedger,
    observed_evidence: [
      {
        claim_or_fact: "E".repeat(50000), // Oversized evidence text
        available_at: IN_WINDOW_TIME,
        grouping_key: "huge-ev-grp",
        source_type: "SEC_FILING",
        provenance: hugeProvenance,
      },
    ],
    sources_status: {
      huge_source: {
        status: "STALE",
        message: "Oversized warning message " + "W".repeat(10000),
        available_at: IN_WINDOW_TIME,
      },
    },
  };

  // Assembly must succeed gracefully without throwing
  const packet = assembleDossierV2InputPacket(request, snapshot);

  // Complete returned packet including packet_id must strictly be <= 200,000 UTF-8 bytes
  const finalJsonStr = toCanonicalJson(packet);
  const finalByteSize = Buffer.byteLength(finalJsonStr, "utf8");

  assert.ok(finalByteSize <= 200000, `Expected complete packet size <= 200000, got ${finalByteSize}`);
  assert.equal(packet.diagnostics.byte_limit_truncation_applied, true);
  assert.ok(packet.thesis_ledger);
  assert.equal(packet.thesis_ledger.entries.length, 1);
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

test("20. attention budget caps and omission count accuracy regression test", () => {
  const request: DossierV2InputRequest = {
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  };

  // 15 Clusters, 8 evidence each, 5 leads each
  const candidateEvidence: CandidateSnapshot["observed_evidence"] = [];
  const candidateLeads: CandidateSnapshot["research_leads"] = [];

  for (let c = 0; c < 15; c++) {
    for (let e = 0; e < 8; e++) {
      candidateEvidence.push({
        claim_or_fact: `Cluster ${c} Ev ${e}`,
        available_at: IN_WINDOW_TIME,
        grouping_key: `cluster-${c}`,
        source_type: "SEC_FILING",
        provenance: [{ source_type: "SEC", source_id: `s-${c}-${e}` }],
      });
    }
    for (let l = 0; l < 5; l++) {
      candidateLeads.push({
        claim_or_question: `Cluster ${c} Lead ${l}?`,
        available_at: IN_WINDOW_TIME,
        grouping_key: `cluster-${c}`,
        provenance: [{ source_type: "LEAD", source_id: `l-${c}-${l}` }],
      });
    }
  }

  // 7 Creator themes with 5 claims each, 3 expand_later
  const candidateThemes: CandidateSnapshot["creator_themes"] = Array.from({ length: 7 }, (_, t) => ({
    theme_name: `Theme ${t}`,
    expand_later: t < 3,
    claims: Array.from({ length: 5 }, (_, c) => ({
      text: `Theme ${t} Claim ${c}`,
      available_at: IN_WINDOW_TIME,
      provenance: [{ source_type: "YOUTUBE", source_id: `yt-${t}-${c}` }],
    })),
  }));

  // 15 Catalysts
  const candidateCatalysts: CandidateSnapshot["catalysts"] = Array.from({ length: 15 }, (_, cat) => ({
    title: `Catalyst ${cat}`,
    available_at: IN_WINDOW_TIME,
    event_time: "2026-04-02T12:00:00.000Z",
    provenance: [{ source_type: "CALENDAR", source_id: `cat-${cat}` }],
  }));

  const snapshot: CandidateSnapshot = {
    observed_evidence: candidateEvidence,
    research_leads: candidateLeads,
    creator_themes: candidateThemes,
    catalysts: candidateCatalysts,
  };

  const packet = assembleDossierV2InputPacket(request, snapshot);

  // Assert caps
  assert.equal(packet.development_clusters.length, 15); // All 15 fit under the 24-cluster budget
  assert.equal(packet.observed_evidence.length, 72); // Max 72 total observed evidence
  assert.equal(packet.creator_themes.length, 5); // Max 5 creator themes
  assert.equal(packet.creator_themes.filter((t) => t.expand_later).length, 2); // Max 2 expand_later
  assert.equal(packet.catalysts.length, 12); // Max 12 catalysts

  // Omission counts must be accurately recorded
  assert.equal(packet.diagnostics.omitted_clusters_count, 0);
  assert.ok(packet.diagnostics.omitted_evidence_count > 0);
  assert.ok(packet.diagnostics.omitted_leads_count > 0);
  assert.equal(packet.diagnostics.omitted_creator_themes_count, 2);
  assert.ok(packet.diagnostics.omitted_creator_claims_count > 0);
  assert.equal(packet.diagnostics.omitted_catalysts_count, 3);
});

test("20b. balanced cluster selection preserves macro spine and fresh non-monitor research", () => {
  const request: DossierV2InputRequest = {
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  };

  const macroSpine = [
    "us2y",
    "us10y",
    "spx",
    "smh",
    "dxy",
    "usdjpy",
    "nikkei",
    "kospi",
    "hang-seng",
    "gold",
    "wti",
    "distillate",
    "crack-distillate",
    "hyg",
  ];

  const observed: CandidateSnapshot["observed_evidence"] = [
    ...macroSpine.map((id) => ({
      evidence_id: `market-monitor:${id}:2026-03-31`,
      claim_or_fact: `Market monitor ${id}`,
      available_at: IN_WINDOW_TIME,
      grouping_key: `market-monitor:${id}`,
      source_type: "MARKET_DATA",
      provenance: [{ source_type: "MARKET_DATA", source_id: `market-monitor:${id}` }],
    })),
    ...Array.from({ length: 8 }, (_, index) => ({
      evidence_id: `market-monitor:filler-${index}:2026-03-31`,
      claim_or_fact: `Market monitor filler ${index}`,
      available_at: IN_WINDOW_TIME,
      grouping_key: `market-monitor:filler-${index}`,
      source_type: "MARKET_DATA",
      provenance: [{ source_type: "MARKET_DATA", source_id: `market-monitor:filler-${index}` }],
    })),
    ...Array.from({ length: 15 }, (_, index) => ({
      evidence_id: `research-evidence-${index}`,
      claim_or_fact: `Fresh research fact ${index}`,
      available_at: IN_WINDOW_TIME,
      grouping_key: `research-cluster-${String(index).padStart(2, "0")}`,
      source_type: "SEC_FILING",
      provenance: [{ source_type: "SEC_FILING", source_id: `research-source-${index}` }],
    })),
  ];

  const packet = assembleDossierV2InputPacket(request, { observed_evidence: observed });
  const groupingKeys = new Set(packet.development_clusters.map((cluster) => cluster.grouping_key));
  const marketClusterCount = packet.development_clusters.filter((cluster) =>
    cluster.grouping_key.startsWith("market-monitor:"),
  ).length;
  const researchClusterCount = packet.development_clusters.length - marketClusterCount;

  assert.equal(packet.development_clusters.length, 24);
  assert.equal(marketClusterCount, 14);
  assert.equal(researchClusterCount, 10);
  for (const id of macroSpine) {
    assert.ok(groupingKeys.has(`market-monitor:${id}`), `missing macro spine cluster ${id}`);
  }
  assert.match(packet.diagnostics.notes.join("\n"), /Balanced cluster selection retained 14 market-monitor clusters and 10 non-monitor research clusters/);
});

test("21. source inspection confirms no forbidden runtime/model/Hybrid/Story/scheduling/publication imports", () => {
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

test("22. graceful non-fatal 200,000-byte reduction for oversized nested metrics object > 200 KB and oversized Thesis lineage/arguments with insertion-order independence", () => {
  const request: DossierV2InputRequest = {
    as_of: TEST_AS_OF,
    previous_dossier_id: null,
  };

  // Build a huge nested metrics object with 35 keys (>20 keys)
  const hugeMetricsKeys: Array<[string, unknown]> = [];
  for (let i = 0; i < 35; i++) {
    const k = `key_large_metric_${String(i).padStart(2, "0")}_` + "K".repeat(100);
    hugeMetricsKeys.push([
      k,
      {
        nested_array: Array.from({ length: 30 }, (_, idx) => "V".repeat(500) + idx),
        nested_string: "S".repeat(5000),
      },
    ]);
  }

  const hugeMetricsObj1: Record<string, unknown> = {};
  for (const [k, v] of hugeMetricsKeys) {
    hugeMetricsObj1[k] = v;
  }

  // Reverse insertion order for snapshot2 to test key-sorting determinism
  const hugeMetricsObj2: Record<string, unknown> = {};
  for (const [k, v] of [...hugeMetricsKeys].reverse()) {
    hugeMetricsObj2[k] = v;
  }

  // Oversized Thesis lineage (50 items) and arguments (30 items)
  const argsList1 = Array.from({ length: 30 }, (_, i) => ({
    arg_id: `arg:${String(i).padStart(2, "0")}`,
    type: i % 2 === 0 ? ("supporting" as const) : ("counter" as const),
    text: `Arg text ${i}: ` + "A".repeat(2000),
  }));

  // Reverse arguments list for snapshot2 to test arguments sorting prior to capping
  const argsList2 = [...argsList1].reverse();

  const ledger1: ThesisLedger = {
    contract_version: THESIS_LEDGER_CONTRACT_VERSION,
    entries: [
      {
        thesis_id: "thesis:collection-test",
        contract_version: THESIS_LEDGER_CONTRACT_VERSION,
        title: "Collection Test Thesis",
        statement: "Valid statement for collection test.",
        state: "confirmed",
        version: 1,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
        lineage: Array.from({ length: 50 }, (_, i) => `lin:${i}:` + "L".repeat(200)),
        arguments: argsList1,
      },
    ],
  };

  const ledger2: ThesisLedger = {
    contract_version: THESIS_LEDGER_CONTRACT_VERSION,
    entries: [
      {
        thesis_id: "thesis:collection-test",
        contract_version: THESIS_LEDGER_CONTRACT_VERSION,
        title: "Collection Test Thesis",
        statement: "Valid statement for collection test.",
        state: "confirmed",
        version: 1,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
        lineage: Array.from({ length: 50 }, (_, i) => `lin:${i}:` + "L".repeat(200)),
        arguments: argsList2,
      },
    ],
  };

  const snapshot1: CandidateSnapshot = {
    thesis_ledger: ledger1,
    observed_evidence: [
      {
        claim_or_fact: "Valid admitted evidence with huge metrics",
        available_at: IN_WINDOW_TIME,
        grouping_key: "huge-metrics-grp",
        source_type: "SEC_FILING",
        metrics: hugeMetricsObj1,
        provenance: [{ source_type: "SEC", source_id: "m1" }],
      },
    ],
  };

  const snapshot2: CandidateSnapshot = {
    thesis_ledger: ledger2,
    observed_evidence: [
      {
        claim_or_fact: "Valid admitted evidence with huge metrics",
        available_at: IN_WINDOW_TIME,
        grouping_key: "huge-metrics-grp",
        source_type: "SEC_FILING",
        metrics: hugeMetricsObj2,
        provenance: [{ source_type: "SEC", source_id: "m1" }],
      },
    ],
  };

  // 1. Assembly does not throw
  const packet1 = assembleDossierV2InputPacket(request, snapshot1);
  const packet2 = assembleDossierV2InputPacket(request, snapshot2);

  // 2. Complete returned packet is <= 200,000 UTF-8 bytes
  const finalJsonStr1 = toCanonicalJson(packet1);
  const finalByteSize1 = Buffer.byteLength(finalJsonStr1, "utf8");
  assert.ok(finalByteSize1 <= 200000, `Expected packet size <= 200000, got ${finalByteSize1}`);

  // 3. Metadata remains valid structured JSON
  assert.ok(packet1.observed_evidence[0].metrics);
  assert.equal(typeof packet1.observed_evidence[0].metrics, "object");
  assert.ok(!Array.isArray(packet1.observed_evidence[0].metrics));

  // 4. Truncation and retained metrics subset is identical across reverse/shuffled insertion orders producing identical packet_id
  assert.equal(packet1.packet_id, packet2.packet_id);
  assert.equal(toCanonicalJson(packet1), toCanonicalJson(packet2));

  // 5. byte_limit_truncation_applied is true
  assert.equal(packet1.diagnostics.byte_limit_truncation_applied, true);
});


test("rate context survives development-cluster budget pressure without expanding the research cluster cap", () => {
  const observed = [
    ...Array.from({ length: 30 }, (_, index) => ({
      evidence_id: `ev:filler:${index}`,
      claim_or_fact: `Filler observed fact ${index}.`,
      available_at: IN_WINDOW_TIME,
      grouping_key: `filler:${String(index).padStart(2, "0")}`,
      rank: index + 1,
      category: "GENERAL",
      source_type: "OFFICIAL_DATA",
      provenance: [{ source_type: "OFFICIAL_DATA", source_id: `filler-${index}` }],
    })),
    {
      evidence_id: "market-monitor:us10y-real:2026-03-31",
      claim_or_fact: "US 10Y real yield was 2.1%.",
      available_at: IN_WINDOW_TIME,
      grouping_key: "market-monitor:us10y-real",
      rank: 999,
      category: "Rates",
      source_type: "MARKET_DATA",
      metrics: {
        last: 2.1,
        change_5d_pct: 1.2,
        provider: "Federal Reserve Economic Data",
      },
      provenance: [{
        source_type: "FRED",
        source_id: "market-monitor:us10y-real",
      }],
    },
  ];

  const packet = assembleDossierV2InputPacket(
    { as_of: TEST_AS_OF, previous_dossier_id: null },
    { observed_evidence: observed },
  );

  assert.ok(packet.development_clusters.length <= 24);
  assert.ok(
    packet.rate_context?.evidence.some(
      (item) => item.evidence_id === "market-monitor:us10y-real:2026-03-31",
    ),
  );
});
