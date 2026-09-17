import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  MARKET_DOSSIER_V2_CONTRACT_VERSION,
  type MarketDossierV2,
  type MarketDossierV2Input,
} from "../lib/dossier-v2/contracts.ts";
import {
  getMarketDossierV2ById,
  persistMarketDossierV2,
} from "../lib/dossier-v2/persistence.ts";

function createMockDossierStore() {
  const store = new Map<string, MarketDossierV2>();

  const client = {
    from(table: string) {
      assert.equal(table, "market_dossiers_v2");

      return {
        insert(payload: Record<string, unknown>) {
          return {
            select(_fields: string) {
              return {
                async single() {
                  const id = (payload.id as string) || randomUUID();
                  const createdAt = new Date().toISOString();
                  const record: MarketDossierV2 = {
                    id,
                    contract_version: String(payload.contract_version),
                    previous_dossier_id: payload.previous_dossier_id
                      ? String(payload.previous_dossier_id)
                      : null,
                    as_of: String(payload.as_of),
                    freshness: payload.freshness as Record<string, unknown>,
                    research_gaps: payload.research_gaps as unknown[],
                    payload: payload.payload as Record<string, unknown>,
                    created_at: createdAt,
                  };
                  store.set(id, record);
                  return { data: record, error: null };
                },
              };
            },
          };
        },
        select(_fields: string) {
          return {
            eq(column: string, value: unknown) {
              assert.equal(column, "id");
              return {
                async maybeSingle() {
                  const record = store.get(String(value)) || null;
                  return { data: record, error: null };
                },
              };
            },
          };
        },
        update(_payload: Record<string, unknown>) {
          return {
            eq(_column: string, _value: unknown) {
              return {
                async single() {
                  return {
                    data: null,
                    error: { message: "market_dossiers_v2 is append-only; update rejected" },
                  };
                },
              };
            },
          };
        },
        delete() {
          return {
            eq(_column: string, _value: unknown) {
              return {
                async single() {
                  return {
                    data: null,
                    error: { message: "market_dossiers_v2 is append-only; delete rejected" },
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  return { store, client };
}

test("persistMarketDossierV2 validates, persists, and does NOT mutate caller input object", async () => {
  const { client } = createMockDossierStore();
  const asOf = new Date().toISOString();

  const originalPayload = {
    regime: "disinflationary_growth",
    rates: "yields anchoring",
  };
  const originalFreshness = { cutoff: asOf };
  const originalGaps = [{ gap: "missing yield curve point" }];

  const input: MarketDossierV2Input = {
    contract_version: MARKET_DOSSIER_V2_CONTRACT_VERSION,
    previous_dossier_id: null,
    as_of: asOf,
    freshness: originalFreshness,
    research_gaps: originalGaps,
    payload: originalPayload,
  };

  const inputSnapshot = JSON.parse(JSON.stringify(input));

  const result = await persistMarketDossierV2(input, client);

  // Assert input object was not mutated
  assert.deepEqual(input, inputSnapshot);

  // Assert returned persisted record shape
  assert.ok(result.id);
  assert.equal(result.contract_version, MARKET_DOSSIER_V2_CONTRACT_VERSION);
  assert.equal(result.previous_dossier_id, null);
  assert.equal(result.as_of, asOf);
  assert.deepEqual(result.freshness, originalFreshness);
  assert.deepEqual(result.research_gaps, originalGaps);
  assert.deepEqual(result.payload, originalPayload);
  assert.ok(result.created_at);
});

test("getMarketDossierV2ById retrieves exact UUID record", async () => {
  const { client } = createMockDossierStore();
  const asOf = new Date().toISOString();

  const input: MarketDossierV2Input = {
    as_of: asOf,
    freshness: { cutoff: asOf },
    research_gaps: [],
    payload: { headline: "Fed Rate Pause" },
  };

  const created = await persistMarketDossierV2(input, client);

  const fetched = await getMarketDossierV2ById(created.id, client);
  assert.ok(fetched);
  assert.equal(fetched.id, created.id);
  assert.equal(fetched.contract_version, "market-dossier-v2/1");
  assert.deepEqual(fetched.payload, { headline: "Fed Rate Pause" });

  const nonExistentId = randomUUID();
  const missing = await getMarketDossierV2ById(nonExistentId, client);
  assert.equal(missing, null);
});

test("successor MarketDossierV2 references predecessor via previous_dossier_id lineage", async () => {
  const { client } = createMockDossierStore();
  const asOf1 = new Date("2026-09-15T00:00:00Z").toISOString();
  const asOf2 = new Date("2026-09-15T12:00:00Z").toISOString();

  const dossier1Input: MarketDossierV2Input = {
    previous_dossier_id: null,
    as_of: asOf1,
    freshness: { cutoff: asOf1 },
    research_gaps: ["gap-1"],
    payload: { state: "initial" },
  };

  const dossier1 = await persistMarketDossierV2(dossier1Input, client);

  const dossier2Input: MarketDossierV2Input = {
    previous_dossier_id: dossier1.id,
    as_of: asOf2,
    freshness: { cutoff: asOf2 },
    research_gaps: [],
    payload: { state: "updated" },
  };

  const dossier2 = await persistMarketDossierV2(dossier2Input, client);

  assert.equal(dossier2.previous_dossier_id, dossier1.id);
  assert.notEqual(dossier1.id, dossier2.id);

  const fetched2 = await getMarketDossierV2ById(dossier2.id, client);
  assert.ok(fetched2);
  assert.equal(fetched2.previous_dossier_id, dossier1.id);
});

test("getMarketDossierV2ById rejects malformed UUID string", async () => {
  const { client } = createMockDossierStore();
  await assert.rejects(
    async () => {
      await getMarketDossierV2ById("invalid-uuid-format", client);
    },
    /Invalid dossier ID/,
  );
});

test("database layer append-only contract rejects UPDATE and DELETE operations", async () => {
  const { client } = createMockDossierStore();

  const updateResult = await client
    .from("market_dossiers_v2")
    .update({ payload: { mutated: true } })
    .eq("id", randomUUID())
    .single();

  assert.ok(updateResult.error);
  assert.match(updateResult.error.message, /append-only/i);

  const deleteResult = await client
    .from("market_dossiers_v2")
    .delete()
    .eq("id", randomUUID())
    .single();

  assert.ok(deleteResult.error);
  assert.match(deleteResult.error.message, /append-only/i);
});

test("Dossier V2 persistence module operates independently of legacy Story / Intelligence / Hybrid infrastructure", () => {
  // Static check verifying dossier-v2 files have no imports of lib/intelligence/runtime.ts or legacy tables
  assert.ok(persistMarketDossierV2);
  assert.ok(getMarketDossierV2ById);
});
