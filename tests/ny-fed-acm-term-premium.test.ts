import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "@e965/xlsx";

import {
  augmentCandidateSnapshotWithAcmTermPremium,
  type CanonicalSnapshotResult,
} from "../lib/dossier-v2/canonical-snapshot.ts";
import {
  assembleDossierV2InputPacket,
  type CandidateSnapshot,
} from "../lib/dossier-v2/input-packet.ts";
import { buildRateLongEndDiagnostic } from "../lib/dossier-v2/rate-long-end-diagnostic.ts";
import {
  fetchNyFedAcmTermPremium,
  parseNyFedAcmTermPremium,
} from "../lib/providers/ny-fed-acm-term-premium.ts";

const AS_OF = new Date("2026-10-03T08:00:00.000Z");
const NOW = new Date("2026-10-03T08:00:30.000Z");

function workbookBytes() {
  const rows = [
    ["DATE", "ACMY10", "ACMTP10", "ACMRNY10"],
    ["24-Sep-2026", 4.95, 0.70, 4.25],
    ["25-Sep-2026", 4.96, 0.71, 4.25],
    ["28-Sep-2026", 4.98, 0.72, 4.26],
    ["29-Sep-2026", 5.01, 0.74, 4.27],
    ["30-Sep-2026", 5.03, 0.75, 4.28],
    ["01-Oct-2026", 5.05, 0.77, 4.28],
    ["02-Oct-2026", 5.08, 0.80, 4.28],
    ["05-Oct-2026", 5.10, 0.83, 4.27],
  ];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "ACM Daily");
  return XLSX.write(book, { type: "array", bookType: "xls" }) as ArrayBuffer;
}

function baseResult(): CanonicalSnapshotResult {
  return {
    snapshot: {
      observed_evidence: [],
      price_data: { status: "OK", available_at: AS_OF.toISOString() },
      macro_data: { status: "OK", available_at: AS_OF.toISOString() },
    } as CandidateSnapshot,
    diagnostics: {
      rows_considered: 0,
      observed_count: 0,
      lead_count: 0,
      catalyst_count: 0,
      skipped_future_count: 0,
      skipped_expired_scheduled_count: 0,
      latest_available_at: null,
      price_data_status: "OK",
      macro_data_status: "OK",
    },
  };
}

test("NY Fed ACM parser reads ACM Daily ACMTP10 and respects the as-of cutoff", () => {
  const snapshot = parseNyFedAcmTermPremium(workbookBytes(), AS_OF, NOW);

  assert.equal(snapshot.status, "OK");
  assert.equal(snapshot.asOf, "2026-10-02");
  assert.equal(snapshot.latest?.termPremium10yPct, 0.8);
  assert.equal(snapshot.prior5Sessions?.date, "2026-09-25");
  assert.equal(snapshot.prior5Sessions?.termPremium10yPct, 0.71);
  assert.equal(snapshot.change5dBp, 9);
  assert.equal(
    snapshot.observations.some((item) => item.date === "2026-10-05"),
    false,
    "future workbook rows must not cross the Dossier as-of boundary",
  );
});

test("NY Fed ACM parser can locate the governed headers if the sheet name changes", () => {
  const rows = [
    ["note", "restructured workbook fixture"],
    ["DATE", "ACMTP10"],
    ["01-Oct-2026", 0.77],
    ["02-Oct-2026", 0.80],
  ];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Daily Data");
  const bytes = XLSX.write(book, { type: "array", bookType: "xls" }) as ArrayBuffer;

  const snapshot = parseNyFedAcmTermPremium(bytes, AS_OF, NOW);
  assert.equal(snapshot.latest?.date, "2026-10-02");
  assert.equal(snapshot.latest?.termPremium10yPct, 0.8);
});

test("current ACM evidence enters protected rate context and resolves the long-end term-premium slot", () => {
  const snapshot = parseNyFedAcmTermPremium(workbookBytes(), AS_OF, NOW);
  const augmented = augmentCandidateSnapshotWithAcmTermPremium(
    baseResult(),
    snapshot,
    { asOf: AS_OF.toISOString() },
  );

  const evidence = augmented.snapshot.observed_evidence?.find((item) =>
    item.evidence_id === "ny-fed-acm:10y:2026-10-02"
  );
  assert.ok(evidence);
  assert.equal(evidence?.source_type, "VERIFIED_MACRO_DATA");
  assert.match(String(evidence?.claim_or_fact ?? ""), /model estimate/i);
  assert.match(String(evidence?.claim_or_fact ?? ""), /not an official estimate/i);
  const metrics = (evidence?.metrics ?? {}) as Record<string, unknown>;
  assert.equal(metrics.signal_kind, "term_structure_model");
  assert.equal(metrics.signal_context, "acm_term_premium");
  assert.equal(metrics.observed_value, 0.8);
  assert.equal(metrics.change_bps, 9);

  const packet = assembleDossierV2InputPacket(
    { as_of: AS_OF.toISOString() },
    augmented.snapshot,
  );
  assert.ok(packet.rate_context?.evidence.some((item) =>
    item.evidence_id === "ny-fed-acm:10y:2026-10-02"
  ));

  const diagnostic = buildRateLongEndDiagnostic(packet);
  assert.equal(diagnostic.termPremium.availability, "OBSERVED");
  assert.equal(diagnostic.termPremium.levelPct, 0.8);
  assert.equal(diagnostic.termPremium.change5dBp, 9);
  assert.equal(diagnostic.termPremium.evidenceRef, "ny-fed-acm:10y:2026-10-02");
  assert.equal(
    diagnostic.gaps.some((gap) => /term-premium observation/i.test(gap)),
    false,
  );
});

test("stale ACM evidence remains explicit rather than being treated as current", () => {
  const staleAsOf = new Date("2026-10-20T08:00:00.000Z");
  const snapshot = parseNyFedAcmTermPremium(workbookBytes(), staleAsOf, staleAsOf);
  assert.equal(snapshot.status, "STALE");

  const augmented = augmentCandidateSnapshotWithAcmTermPremium(
    baseResult(),
    snapshot,
    { asOf: staleAsOf.toISOString() },
  );
  const packet = assembleDossierV2InputPacket(
    { as_of: staleAsOf.toISOString() },
    augmented.snapshot,
  );
  const diagnostic = buildRateLongEndDiagnostic(packet);
  assert.equal(diagnostic.termPremium.availability, "STALE");
});

test("ACM acquisition refuses current-vintage data for old historical replay", async () => {
  let called = false;
  const snapshot = await fetchNyFedAcmTermPremium({
    asOf: new Date("2026-09-01T00:00:00.000Z"),
    now: new Date("2026-10-05T00:00:00.000Z"),
    fetchImpl: async () => {
      called = true;
      return new Response(workbookBytes());
    },
  });

  assert.equal(called, false);
  assert.equal(snapshot.status, "UNAVAILABLE");
  assert.match(snapshot.warnings[0] ?? "", /historical replay/i);
});

test("ACM acquisition fails closed on provider failure", async () => {
  const snapshot = await fetchNyFedAcmTermPremium({
    asOf: AS_OF,
    now: NOW,
    fetchImpl: async () => new Response("down", { status: 503 }),
  });
  assert.equal(snapshot.status, "UNAVAILABLE");
  assert.equal(snapshot.latest, null);
  assert.match(snapshot.warnings[0] ?? "", /HTTP 503/);
});
