import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  handleDossierV2DryRunWithDependencies,
} from "../lib/dossier-v2/manual-dry-run-trigger.ts";
import type { ManualDossierV2RunResult } from "../lib/dossier-v2/manual-run.ts";
import type { DossierV2InputPacket } from "../lib/dossier-v2/input-packet.ts";
import type { ResearchBrainOutputV1 } from "../lib/dossier-v2/research-brain-contracts.ts";

const authorized = async () => ({
  authorized: true as const,
  actor: "production-operator",
  githubRunId: "98765",
  workflowSha: "abc123",
});

function request(body: unknown, authorization = "Bearer oidc-token") {
  return new Request("https://example.com/api/admin/dossier-v2/dry-run", {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function dryRunResult(): ManualDossierV2RunResult {
  const packet = {
    contract_version: "dossier-v2-input-packet/1",
    packet_id: "packet:task10",
    as_of: "2026-09-20T00:00:00.000Z",
    previous_dossier_id: null,
    observed_evidence: [],
    research_leads: [],
    prior_analytical_state: { claims: [] },
    development_clusters: [],
    catalysts: [],
    creator_themes: [],
    thesis_ledger: null,
    conflicts: [],
    freshness_warnings: [],
    research_gaps: [],
    provenance_index: [],
    diagnostics: {
      omitted_evidence_count: 0,
      omitted_lead_count: 0,
      omitted_prior_claim_count: 0,
      omitted_cluster_count: 0,
      omitted_catalyst_count: 0,
      omitted_creator_theme_count: 0,
      packet_reduction_applied: false,
      packet_size_bytes: 1,
    },
  } as unknown as DossierV2InputPacket;

  const analyticalOutput = {
    contract_version: "research-brain/1",
    packet_id: packet.packet_id,
    as_of: packet.as_of,
    main_thread: {
      thread_id: "thread:task10",
      headline: "Insufficient direct evidence",
      answer: "The desk remains unresolved.",
      regime_implication: "No regime claim.",
      regime_family: "UNRESOLVED",
      epistemic_label: "SPECULATIVE",
      evidence_references: [],
      supporting_story_ids: [],
      contradiction_references: [],
      what_would_change_mind: "Current direct evidence.",
    },
    major_stories: [],
    chart_investigation_queue: { core: [], optional: [] },
    investigations: [],
    market_verdict: {
      verdict_id: "verdict:task10",
      lenses: {},
      cross_asset_readthrough: "Unresolved.",
      epistemic_label: "SPECULATIVE",
      dominant_confirmation: "None.",
      dominant_contradiction: "Missing direct evidence.",
    },
    research_now: [],
    stock_radar: [],
    developing_themes: [],
    creator_theme_expansions: [],
    thesis_ledger: { contract_version: "thesis-ledger/2", entries: [] },
    contradictions_detected: [],
    research_gaps: [],
    diagnostics: {
      degraded: true,
      degradation_reasons: ["fixture"],
      omitted_or_demoted_items: [],
      missing_input_categories: ["PRICE_DATA"],
      model_repair_used: false,
      notes: [],
    },
  } as unknown as ResearchBrainOutputV1;

  return {
    mode: "dry_run",
    persistence_available: false,
    previous_dossier_id: null,
    snapshot_diagnostics: {
      rows_considered: 3,
      observed_count: 0,
      lead_count: 3,
      catalyst_count: 0,
      skipped_future_count: 0,
      skipped_expired_scheduled_count: 1,
      latest_available_at: "2026-09-19T22:00:00.000Z",
      price_data_status: "MISSING",
      macro_data_status: "MISSING",
    },
    packet,
    analytical_output: analyticalOutput,
  };
}

test("Task 10 rejects unauthorised dry-run requests before model execution", async () => {
  let runCalled = false;
  const response = await handleDossierV2DryRunWithDependencies(request({}), {
    authorize: async () => ({ authorized: false }),
    run: async () => {
      runCalled = true;
      return dryRunResult();
    },
  });

  assert.equal(response.status, 401);
  assert.equal(runCalled, false);
});

test("Task 10 hard-rejects persist and other unknown control fields", async () => {
  let runCalled = false;
  const response = await handleDossierV2DryRunWithDependencies(
    request({ persist: true }),
    {
      authorize: authorized,
      run: async () => {
        runCalled = true;
        return dryRunResult();
      },
    },
  );

  assert.equal(response.status, 400);
  assert.equal(runCalled, false);

  const body = await response.json();
  assert.equal(body.error, "Unsupported dry-run input field.");
  assert.deepEqual(body.fields, ["persist"]);
});

test("Task 10 authorised request runs once with bounded read-only options", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const response = await handleDossierV2DryRunWithDependencies(
    request({
      asOf: "2026-09-20T00:00:00Z",
      lookbackHours: 72,
      evidenceLimit: 120,
    }),
    {
      authorize: authorized,
      now: () => new Date("2026-09-20T01:00:00.000Z"),
      run: async (options) => {
        calls.push(options);
        return dryRunResult();
      },
      logger: () => undefined,
    },
  );

  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    asOf: "2026-09-20T00:00:00.000Z",
    lookbackHours: 72,
    evidenceLimit: 120,
  });

  const body = await response.json();
  assert.equal(body.status, "completed");
  assert.equal(body.mode, "dry_run");
  assert.equal(body.packetSummary.packetId, "packet:task10");
  assert.equal(body.analyticalOutput.main_thread.thread_id, "thread:task10");
});

test("Task 10 bounds lookback and evidence limit before execution", async () => {
  let runCalled = false;
  const response = await handleDossierV2DryRunWithDependencies(
    request({ lookbackHours: 721, evidenceLimit: 501 }),
    {
      authorize: authorized,
      run: async () => {
        runCalled = true;
        return dryRunResult();
      },
    },
  );

  assert.equal(response.status, 400);
  assert.equal(runCalled, false);
});

test("Task 10 production route and workflow use the existing trusted OIDC boundary", () => {
  const route = readFileSync(
    new URL("../app/api/admin/dossier-v2/dry-run/route.ts", import.meta.url),
    "utf8",
  );
  const handler = readFileSync(
    new URL("../lib/dossier-v2/manual-dry-run-trigger.ts", import.meta.url),
    "utf8",
  );
  const workflow = readFileSync(
    new URL("../.github/workflows/run-live-research.yml", import.meta.url),
    "utf8",
  );

  assert.match(route, /handleDossierV2DryRunWithDependencies/);
  assert.match(handler, /verifyGitHubActionsManualLiveTrigger/);
  assert.match(handler, /persist:\s*false/);
  assert.match(workflow, /dossier_v2_dry_run/);
  assert.match(workflow, /api\/admin\/dossier-v2\/dry-run/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /id-token:\s*write/);
  assert.doesNotMatch(workflow, /CRON_SECRET/);
  assert.doesNotMatch(workflow, /RESEARCH_UPDATE_TOKEN/);
});
