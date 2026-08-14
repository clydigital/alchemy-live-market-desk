import assert from "node:assert/strict";
import test from "node:test";

import { annotateRunKeySchemaDrift, startIntelligenceEngineRunWithClient } from "../lib/intelligence/engine-run-contract.ts";

test("engine-run startup is idempotent for the same run_key", async () => {
  const rows: Array<{
    id: string;
    research_run_id: string | null;
    trigger_kind: string;
    status: string;
    run_key: string;
    warnings: string[];
    metadata: Record<string, unknown>;
    started_at: string;
  }> = [];
  let nextId = 1;

  const intelligenceRest = async <T>(path: string, init?: RequestInit): Promise<T> => {
    if (path.startsWith("intelligence_engine_runs?select=")) {
      const parsed = new URL(`https://alchemy.test/${path}`);
      const runKey = parsed.searchParams.get("run_key")?.replace(/^eq\./, "");
      return rows
        .filter((row) => row.run_key === runKey)
        .map((row) => ({
          id: row.id,
          status: row.status,
          stories_considered: 0,
          stories_published: 0,
          warnings: row.warnings,
          metadata: row.metadata,
        })) as T;
    }
    if (path === "intelligence_engine_runs?on_conflict=run_key") {
      const payload = JSON.parse(String(init?.body)) as Omit<(typeof rows)[number], "id">;
      let existing = rows.find((row) => row.run_key === payload.run_key);
      if (!existing) {
        existing = { ...payload, id: `engine-run-${nextId++}` };
        rows.push(existing);
      }
      return [{
        id: existing.id,
        status: existing.status,
        stories_considered: 0,
        stories_published: 0,
        warnings: existing.warnings,
        metadata: existing.metadata,
      }] as T;
    }
    throw new Error(`Unexpected intelligenceRest path: ${path}`);
  };

  const first = await startIntelligenceEngineRunWithClient(intelligenceRest, {
    researchRunId: "research-run-1",
    triggerKind: "scheduled",
    runKey: "repair:test:2026-08-14T21:15",
    dryRun: false,
  });
  const second = await startIntelligenceEngineRunWithClient(intelligenceRest, {
      researchRunId: "research-run-1",
      triggerKind: "scheduled",
      runKey: "repair:test:2026-08-14T21:15",
      dryRun: false,
    });

  assert.equal(first.kind, "started");
  assert.equal(second.kind, "started");
  assert.equal(first.engineRunId, second.engineRunId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.run_key, "repair:test:2026-08-14T21:15");
});

test("schema drift errors keep the original 42P10 detail and add actionability", () => {
  const error = annotateRunKeySchemaDrift(
    new Error(
      'Intelligence database request failed (400): {"code":"42P10","details":null,"hint":null,"message":"there is no unique or exclusion constraint matching the ON CONFLICT specification"}',
    ),
  );

  assert.ok(error instanceof Error);
  assert.match(error.message, /42P10/);
  assert.match(error.message, /there is no unique or exclusion constraint matching the ON CONFLICT specification/);
  assert.match(error.message, /public\.intelligence_engine_runs\.run_key must exist as a non-null text column/);
  assert.match(error.message, /Apply the forward schema-parity migration/);
});
