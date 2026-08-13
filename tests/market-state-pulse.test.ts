import assert from "node:assert/strict";
import test from "node:test";
import { buildLiveDeskPulse } from "../lib/live-desk-pulse.ts";
import type { MarketStateRecord } from "@/lib/data";

test("Pulse becomes available when valid market-state exists", () => {
  const records: MarketStateRecord[] = [
    {
      id: "test-id-1",
      module_key: "energy-crude",
      sector: "Energy",
      sub_industry: "Crude oil and physical energy",
      status: "active",
      direction: "Boon",
      magnitude: 70,
      probability: 80,
      risk: "Low",
      boon: "High",
      beneficiaries: ["Consumers"],
      losers: ["Producers"],
      evidence_summary: "WTI Crude is lower",
      source_name: "EIA",
      source_url: "https://eia.gov",
      source_type: "official",
      observed_at: "2026-08-11T00:00:00Z",
      next_test: "weekly check",
      owner_status: "active",
      created_at: "2026-08-11T00:00:00Z",
      updated_at: "2026-08-11T00:00:00Z"
    }
  ];

  const pulse = buildLiveDeskPulse(records, null);
  assert.equal(pulse.available, true);
  assert.equal(pulse.boons, 1);
  assert.equal(pulse.risks, 0);
  assert.equal(pulse.label, "Constructive");
});

test("Pulse is unavailable if no market state records exist", () => {
  const pulse = buildLiveDeskPulse([], null);
  assert.equal(pulse.available, false);
  assert.equal(pulse.label, "Unavailable");
});
