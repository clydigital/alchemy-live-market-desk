import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  handleDossierV2PersistRunWithDependencies,
} from "../lib/dossier-v2/manual-persist-trigger.ts";
import type { ManualDossierV2RunResult } from "../lib/dossier-v2/manual-run.ts";

const authorized = async () => ({
  authorized: true as const,
  actor: "production-operator",
  githubRunId: "12345",
  workflowSha: "abc123",
});

function request(body: unknown) {
  return new Request("https://example.com/api/admin/dossier-v2/run", {
    method: "POST",
    headers: {
      authorization: "Bearer oidc-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function persistedResult(): ManualDossierV2RunResult {
  return {
    mode: "persisted",
    persistence_available: true,
    previous_dossier_id: null,
    snapshot_diagnostics: {
      rows_considered: 2,
      observed_count: 1,
      lead_count: 1,
      catalyst_count: 0,
      skipped_future_count: 0,
      skipped_expired_scheduled_count: 0,
      latest_available_at: "2026-09-20T23:00:00.000Z",
      price_data_status: "CURRENT",
      macro_data_status: "CURRENT",
    },
    packet: {
      packet_id: "packet:task1",
      as_of: "2026-09-21T00:00:00.000Z",
      observed_evidence: [{}],
      research_leads: [{}],
      development_clusters: [],
      catalysts: [],
      creator_themes: [],
      freshness_warnings: [],
      research_gaps: [],
      diagnostics: {},
    },
    analytical_output: {
      main_thread: {
        thread_id: "thread:task1",
        headline: "Task 1 production proof",
      },
      diagnostics: {
        degraded: false,
      },
    },
    dossier: {
      id: "11111111-1111-4111-8111-111111111111",
      contract_version: "market-dossier-v2/1",
      previous_dossier_id: null,
      as_of: "2026-09-21T00:00:00.000Z",
      freshness: {},
      research_gaps: [],
      payload: {},
      created_at: "2026-09-21T00:01:00.000Z",
    },
  } as unknown as ManualDossierV2RunResult;
}

test("Task 1 rejects unauthorised persistence requests", async () => {
  let runCalled = false;
  const response = await handleDossierV2PersistRunWithDependencies(request({}), {
    authorize: async () => ({ authorized: false }),
    run: async () => {
      runCalled = true;
      return persistedResult();
    },
  });

  assert.equal(response.status, 401);
  assert.equal(runCalled, false);
});

test("Task 1 rejects persistence control fields from the request body", async () => {
  let runCalled = false;
  const response = await handleDossierV2PersistRunWithDependencies(
    request({ persist: false }),
    {
      authorize: authorized,
      run: async () => {
        runCalled = true;
        return persistedResult();
      },
    },
  );

  assert.equal(response.status, 400);
  assert.equal(runCalled, false);

  const body = await response.json();
  assert.equal(body.error, "Unsupported persistence input field.");
  assert.deepEqual(body.fields, ["persist"]);
});

test("Task 1 authorised request persists once with bounded options", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const response = await handleDossierV2PersistRunWithDependencies(
    request({
      asOf: "2026-09-21T00:00:00Z",
      lookbackHours: 72,
      evidenceLimit: 120,
    }),
    {
      authorize: authorized,
      run: async (options) => {
        calls.push(options);
        return persistedResult();
      },
      logger: () => undefined,
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{
    asOf: "2026-09-21T00:00:00.000Z",
    lookbackHours: 72,
    evidenceLimit: 120,
    strategy: "rebase",
  }]);

  const body = await response.json();
  assert.equal(body.status, "completed");
  assert.equal(body.mode, "persisted");
  assert.equal(
    body.persistedDossier.id,
    "11111111-1111-4111-8111-111111111111",
  );
});

test("automatic strategy may complete with NO_CHANGE without persisting a duplicate dossier", async () => {
  const response = await handleDossierV2PersistRunWithDependencies(
    request({
      asOf: "2026-09-21T00:00:00Z",
      strategy: "auto",
    }),
    {
      authorize: authorized,
      run: async () => ({
        ...persistedResult(),
        mode: "no_change",
        delta_decision: {
          action: "NO_CHANGE",
          reason: "No new material canonical Story state was produced.",
          previousDossierId: "11111111-1111-4111-8111-111111111111",
          previousAsOf: "2026-09-21T00:00:00.000Z",
          changedStoryIds: [],
          newObservedEvidence: 0,
          postIntelligenceModelCallBudget: 0,
        },
      }),
      logger: () => undefined,
    },
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.mode, "no_change");
  assert.equal(body.strategy, "auto");
  assert.equal(body.dossierDecision.action, "NO_CHANGE");
  assert.equal(body.persistedDossier, null);
  assert.equal(body.currentDossier.id, "11111111-1111-4111-8111-111111111111");
});

test("Task 1 production route and workflow keep the trusted OIDC boundary", () => {
  const route = readFileSync(
    new URL("../app/api/admin/dossier-v2/run/route.ts", import.meta.url),
    "utf8",
  );
  const handler = readFileSync(
    new URL("../lib/dossier-v2/manual-persist-trigger.ts", import.meta.url),
    "utf8",
  );
  const workflow = readFileSync(
    new URL("../.github/workflows/run-live-research.yml", import.meta.url),
    "utf8",
  );

  assert.match(route, /handleDossierV2PersistRunWithDependencies/);
  assert.match(handler, /verifyGitHubActionsManualLiveTrigger/);
  assert.match(handler, /persist:\s*true/);
  assert.match(workflow, /dossier_v2_persist/);
  assert.match(workflow, /api\/admin\/dossier-v2\/run/);
  assert.match(workflow, /strategy:"auto"/);
  assert.match(workflow, /Run token-aware Dossier V2 handoff/);
  assert.match(workflow, /id-token:\s*write/);
  assert.doesNotMatch(workflow, /CRON_SECRET/);
  assert.doesNotMatch(workflow, /RESEARCH_UPDATE_TOKEN/);
});
