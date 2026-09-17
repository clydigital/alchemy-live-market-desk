import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  MARKET_DOSSIER_V2_CONTRACT_VERSION,
  type MarketDossierV2Input,
} from "../lib/dossier-v2/contracts.ts";
import {
  validateMarketDossierV2Input,
  validateMarketDossierV2Record,
} from "../lib/dossier-v2/validation.ts";

test("MarketDossierV2 contract version constant is explicitly set", () => {
  assert.equal(MARKET_DOSSIER_V2_CONTRACT_VERSION, "market-dossier-v2/1");
});

test("validateMarketDossierV2Input accepts valid input envelope", () => {
  const validAsOf = new Date().toISOString();
  const input: MarketDossierV2Input = {
    contract_version: MARKET_DOSSIER_V2_CONTRACT_VERSION,
    previous_dossier_id: null,
    as_of: validAsOf,
    freshness: {
      cutoff: validAsOf,
      sourcesEvaluated: 14,
      oldestSourceAgeHours: 2.5,
    },
    research_gaps: [
      { gap_id: "gap-1", topic: "Japan MOF weekly flows", priority: "medium" },
    ],
    payload: {
      regime: "disinflationary_growth",
      rates: { us10y: 4.25, fed_funds: 5.25 },
      tech: { narrative: "AI infrastructure capex resilience" },
      oil_war: { status: "supply_side_risk_premium" },
      main_thread: "Fed rate policy calibration amidst firm economic data",
      catalysts: ["FOMC Decision", "CPI Release"],
    },
  };

  const validated = validateMarketDossierV2Input(input);
  assert.equal(validated.contract_version, "market-dossier-v2/1");
  assert.equal(validated.previous_dossier_id, null);
  assert.equal(validated.as_of, validAsOf);
  assert.deepEqual(validated.freshness, input.freshness);
  assert.deepEqual(validated.research_gaps, input.research_gaps);
  assert.deepEqual(validated.payload, input.payload);
});

test("validateMarketDossierV2Record accepts valid database record", () => {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const asOf = new Date().toISOString();

  const record = {
    id,
    contract_version: MARKET_DOSSIER_V2_CONTRACT_VERSION,
    previous_dossier_id: null,
    as_of: asOf,
    freshness: { cutoff: asOf },
    research_gaps: [],
    payload: { summary: "Analytical payload" },
    created_at: createdAt,
  };

  const validated = validateMarketDossierV2Record(record);
  assert.equal(validated.id, id);
  assert.equal(validated.created_at, createdAt);
  assert.equal(validated.as_of, asOf);
  assert.equal(validated.contract_version, "market-dossier-v2/1");
});

test("validateMarketDossierV2Input rejects invalid contract version", () => {
  assert.throws(
    () => {
      validateMarketDossierV2Input({
        contract_version: "invalid-version/99",
        as_of: new Date().toISOString(),
        freshness: {},
        research_gaps: [],
        payload: {},
      });
    },
    /Invalid contract_version/,
  );
});

test("validateMarketDossierV2Input rejects invalid id UUID", () => {
  assert.throws(
    () => {
      validateMarketDossierV2Input({
        id: "not-a-uuid",
        as_of: new Date().toISOString(),
        freshness: {},
        research_gaps: [],
        payload: {},
      });
    },
    /Invalid id/,
  );
});

test("validateMarketDossierV2Input rejects invalid previous_dossier_id", () => {
  assert.throws(
    () => {
      validateMarketDossierV2Input({
        previous_dossier_id: "not-a-valid-uuid",
        as_of: new Date().toISOString(),
        freshness: {},
        research_gaps: [],
        payload: {},
      });
    },
    /Invalid previous_dossier_id/,
  );
});

test("validateMarketDossierV2Input rejects invalid as_of timestamp", () => {
  assert.throws(
    () => {
      validateMarketDossierV2Input({
        as_of: "invalid-date-string",
        freshness: {},
        research_gaps: [],
        payload: {},
      });
    },
    /Invalid as_of timestamp/,
  );
});

test("validateMarketDossierV2Input rejects non-object freshness", () => {
  assert.throws(
    () => {
      validateMarketDossierV2Input({
        as_of: new Date().toISOString(),
        freshness: "not-an-object",
        research_gaps: [],
        payload: {},
      });
    },
    /Invalid freshness/,
  );
});

test("validateMarketDossierV2Input rejects non-array research_gaps", () => {
  assert.throws(
    () => {
      validateMarketDossierV2Input({
        as_of: new Date().toISOString(),
        freshness: {},
        research_gaps: { gap: "not an array" },
        payload: {},
      });
    },
    /Invalid research_gaps/,
  );
});

test("validateMarketDossierV2Input rejects non-object payload", () => {
  assert.throws(
    () => {
      validateMarketDossierV2Input({
        as_of: new Date().toISOString(),
        freshness: {},
        research_gaps: [],
        payload: "not-an-object",
      });
    },
    /Invalid payload/,
  );
});

test("representative analytical fixture round-trips envelope validation without legacy dependencies", () => {
  const asOf = new Date().toISOString();
  const fixtureInput: MarketDossierV2Input = {
    contract_version: MARKET_DOSSIER_V2_CONTRACT_VERSION,
    previous_dossier_id: null,
    as_of: asOf,
    freshness: {
      cutoff: asOf,
      sensor_timestamps: {
        finra_short_volume: "2026-09-14T22:00:00Z",
        macro_releases: "2026-09-15T01:00:00Z",
      },
    },
    research_gaps: [
      { gap_type: "unresolved_contradiction", details: "Divergence between UST 10Y yield and Fed pricing" },
    ],
    payload: {
      macro_regime: "Late Cycle Soft Landing",
      cross_asset: {
        rates: "Yield curve steepening driven by supply concerns",
        bonds: "Term premium expanding",
        tech: "Hyperscaler capex guidance supporting semiconductor hardware",
        oil_war: "Geopolitical risk premium muted by OPEC+ spare capacity",
      },
      main_thread: "Inflation moderation vs fiscal supply absorption",
      major_stories: [
        { title: "Treasury Quarterly Refunding", status: "active" },
      ],
      stock_radar: ["NVDA", "AAPL", "MSFT"],
      catalysts: [
        { event: "US CPI", scheduled_at: "2026-09-16T12:30:00Z" },
      ],
    },
  };

  const validated = validateMarketDossierV2Input(fixtureInput);
  assert.equal(validated.contract_version, MARKET_DOSSIER_V2_CONTRACT_VERSION);
  assert.equal(validated.previous_dossier_id, null);
  assert.equal((validated.payload.cross_asset as Record<string, string>).tech, "Hyperscaler capex guidance supporting semiconductor hardware");
});
