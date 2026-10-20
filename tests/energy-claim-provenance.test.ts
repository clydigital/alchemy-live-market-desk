import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assembleDossierV2InputPacket, type ObservedEvidence } from "../lib/dossier-v2/input-packet.ts";
import { buildEnergyClaimCoverage, energyClaimProvenanceErrors } from "../lib/dossier-v2/energy-claim-provenance.ts";

const ID = "f05e69a9-1e74-4072-a526-302020000112";
const ASOF = "2026-10-21T01:00:00Z";
function packet(rows: ObservedEvidence[] = []) {
  const p = assembleDossierV2InputPacket({ as_of: ASOF }, { observed_evidence: [] });
  p.observed_evidence = rows;
  return p;
}
function marketRow(kind: "WTI" | "BRENT", overrides: Partial<ObservedEvidence> = {}): ObservedEvidence {
  const wti = kind === "WTI";
  const url = wti
    ? "https://www.cmegroup.com/daily_bulletin/archive/20261014/Section61_Energy_Futures_Products.pdf"
    : "https://www.ice.com/marketdata/20261014/settlements/brent";
  return {
    evidence_id: wti ? ID : "842a0702-2357-4105-8c7f-4f3f684a1ef4",
    canonical_record_backed: true,
    epistemic_label: "OBSERVED",
    claim_or_fact: "Original final dated two-contract exchange settlement pair.",
    category: "ENERGY",
    source_type: "VERIFIED_MACRO_DATA",
    available_at: "2026-10-20T22:00:00Z",
    occurrence_time: "2026-10-14T00:00:00Z",
    metrics: {
      source_tier: 1,
      signal_kind: "official_futures_settlement_pair",
      benchmark: kind,
      exchange: wti ? "NYMEX" : "ICE",
      final: true,
      unit: "USD_per_barrel",
      trade_date: "2026-10-14",
      front_contract: wti ? "CLX26" : "LCOZ26",
      next_contract: wti ? "CLZ26" : "LCOF27",
      front_settle: 101,
      next_settle: 98,
      source_sha256: "a".repeat(64),
    },
    provenance: [{ source_type: "EXCHANGE", source_id: "original-final", url }],
    ...overrides,
  };
}
function arrival(): ObservedEvidence {
  return {
    ...marketRow("WTI"),
    evidence_id: "cb81a470-8655-4c64-87c1-343e4409fb19",
    claim_or_fact: "Customs verified Russian-origin diesel delivery to US terminal.",
    provenance: [{ source_type: "OFFICIAL", source_id: "import-id", url: "https://www.cbp.gov/trade/imports/arrival-001" }],
    metrics: {
      source_tier: 1,
      signal_kind: "official_import_arrival",
      fuel: "DIESEL", origin_country: "RU", destination_country: "US",
      vessel_imo: "1234567", port: "Houston", arrival_date: "2026-10-14", final: true,
    },
  };
}

test("scheduled Research Brain fails closed when curve and shipment proof is missing", () => {
  const p = packet();
  const coverage = buildEnergyClaimCoverage(p);
  assert.equal(coverage.unresolvedRequirements.length, 3);
  assert.equal(energyClaimProvenanceErrors("WTI is in backwardation.", p).length, 1);
  assert.equal(energyClaimProvenanceErrors("Brent has a front-month premium.", p).length, 1);
  assert.equal(energyClaimProvenanceErrors("Russian-origin diesel arrived in the U.S. yesterday.", p).length, 1);
  assert.equal(energyClaimProvenanceErrors("Russian diesel was imported into the US.", p).length, 1);
  assert.deepEqual(energyClaimProvenanceErrors("WTI backwardation remains unverified.", p), []);
  assert.deepEqual(energyClaimProvenanceErrors("ICE Brent backwardation could tighten if storage costs rise.", p), []);
  assert.deepEqual(energyClaimProvenanceErrors("OFAC authorised Russian-origin diesel imports into the US.", p), []);
  assert.deepEqual(energyClaimProvenanceErrors("MarketWatch reported WTI backwardation, unverified by exchange settlements.", p), []);
});

test("only exact-date exchange FINAL F1/F2, immutable source, and first-tier provenance qualify", () => {
  const [wti, brent] = [marketRow("WTI"), marketRow("BRENT")];
  const positive = packet([wti, brent, arrival()]);
  assert.equal(buildEnergyClaimCoverage(positive).unresolvedRequirements.length, 0);
  assert.deepEqual(energyClaimProvenanceErrors("On 14 October 2026 WTI was in backwardation.", positive), []);
  assert.deepEqual(energyClaimProvenanceErrors("Brent had a positive front-month spread on 2026-10-14.", positive), []);
  assert.equal(energyClaimProvenanceErrors("WTI is in backwardation.", positive).length, 1,
    "Old archived contract pair cannot prove the present-day curve");
  assert.equal(energyClaimProvenanceErrors("Brent had a positive front-month spread on 2026-10-15.", positive).length, 1,
    "Original settles for October 14 cannot justify an October 15 claim");
  assert.deepEqual(energyClaimProvenanceErrors("Russian diesel arrived in the U.S.", positive), []);

  const changes = [
    { name: "third-party report", metrics: { ...wti.metrics, source_tier: 3 } },
    { name: "rotating source", provenance: [{ source_type: "EXCHANGE", source_id: "current", url: "https://www.cmegroup.com/daily_bulletin/current/Section61_Energy_Futures_Products.pdf" }] },
    { name: "missing original hash", metrics: { ...wti.metrics, source_sha256: null } },
    { name: "not final", metrics: { ...wti.metrics, final: false } },
    { name: "wrong day", metrics: { ...wti.metrics, trade_date: "2026-10-15" } },
    { name: "same contract", metrics: { ...wti.metrics, next_contract: "CLX26" } },
    { name: "not a spread", metrics: { ...wti.metrics, next_settle: 104 } },
    { name: "future availability", available_at: "2026-10-22T00:00:00Z" },
  ] as Array<{ name: string } & Partial<ObservedEvidence>>;
  for (const candidate of changes) {
    const modified: ObservedEvidence = { ...wti, ...candidate };
    const result = energyClaimProvenanceErrors("WTI was in backwardation.", packet([modified]));
    assert.equal(result.length, 1, candidate.name);
  }
});

test("first-party OFAC legal authorisation alone is not proof of a delivered cargo", () => {
  const ofac: ObservedEvidence = {
    ...marketRow("WTI"),
    evidence_id: "4c88a390-6ec0-474d-97c1-a17dd59b71ec",
    metrics: { source_tier: 1, signal_kind: "official_release", authorisation: "GL135", origin_country: "RU" },
    provenance: [{ source_type: "OFFICIAL", source_id: "ofac-135", url: "https://ofac.treasury.gov/recent-actions/20261009_33" }],
  };
  const p = packet([ofac]);
  assert.equal(buildEnergyClaimCoverage(p).usRussianDieselDeliveryEvidenceId, null);
  assert.equal(energyClaimProvenanceErrors("Russian diesel was delivered to the United States.", p).length, 1);
  assert.deepEqual(energyClaimProvenanceErrors("OFAC authorised Russian-origin diesel import transactions.", p), []);
});

test("existing Dossier scheduled production validator and repair pathway enforce energy guard", () => {
  const validate = readFileSync(new URL("../lib/dossier-v2/research-brain-validation.ts", import.meta.url), "utf8");
  const prompt = readFileSync(new URL("../lib/dossier-v2/research-brain-prompt.ts", import.meta.url), "utf8");
  const workflow = readFileSync(new URL("../.github/workflows/run-live-research.yml", import.meta.url), "utf8");
  assert.match(validate, /energyClaimProvenanceErrors\(headline, packet\)/);
  assert.match(validate, /energyClaimProvenanceErrors\(answer, packet\)/);
  assert.match(validate, /energyClaimProvenanceErrors\(claim, packet\)/);
  assert.match(prompt, /system1_energy_source_coverage: buildEnergyClaimCoverage\(packet\)/);
  assert.match(prompt, /OFAC authorisation/);
  assert.match(workflow, /Run token-aware Dossier V2 handoff/);
  assert.match(workflow, /dossier_v2_dry_run/);
});
