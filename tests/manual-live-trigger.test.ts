import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { handleManualLiveTriggerWithDependencies } from "../lib/manual-live-trigger.ts";

const authorized = async () => ({
  authorized: true as const,
  actor: "production-operator",
  githubRunId: "123456",
  workflowSha: "abc123",
});

function request(body: unknown, authorization = "Bearer short-lived-oidc-token") {
  return new Request("https://example.com/api/admin/research/run", {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

test("an authorised acquisition invocation reuses the canonical scheduled handler", async () => {
  const calls: Array<{ request: Request; slot: string }> = [];
  const response = await handleManualLiveTriggerWithDependencies(request({
    slot: "evening",
    stage: "acquisition",
    retryKey: "live-e2e-20260817-1904",
  }), {
    authorize: authorized,
    cronSecret: () => "internal-cron-secret",
    acquisition: async (canonicalRequest, slot) => {
      calls.push({ request: canonicalRequest, slot });
      return Response.json({ status: "intelligence_pending" });
    },
    logger: () => undefined,
  });

  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.slot, "evening");
  assert.equal(
    calls[0]?.request.url,
    "https://live-internal.invalid/api/cron/research/evening?retry=live-e2e-20260817-1904",
  );
  assert.equal(calls[0]?.request.headers.get("authorization"), "Bearer internal-cron-secret");
  assert.equal(calls[0]?.request.headers.get("x-alchemy-manual-trigger"), "github-actions-oidc");
});

test("an authorised intelligence invocation preserves the same retry identity", async () => {
  let canonicalUrl = "";
  let acquisitionCalled = false;
  const response = await handleManualLiveTriggerWithDependencies(request({
    slot: "morning",
    stage: "intelligence",
    retryKey: "live-e2e-20260817-1904",
  }), {
    authorize: authorized,
    cronSecret: () => "internal-cron-secret",
    acquisition: async () => {
      acquisitionCalled = true;
      return Response.json({});
    },
    intelligence: async (canonicalRequest) => {
      canonicalUrl = canonicalRequest.url;
      return Response.json({ status: "completed", runId: "run-1" });
    },
    logger: () => undefined,
  });

  assert.equal(response.status, 200);
  assert.equal(acquisitionCalled, false);
  assert.match(canonicalUrl, /morning\?retry=live-e2e-20260817-1904$/);
});

test("unauthorised public requests are rejected before credentials or handlers are used", async () => {
  let cronSecretRead = false;
  let handlerCalled = false;
  const response = await handleManualLiveTriggerWithDependencies(request({
    slot: "evening",
    stage: "acquisition",
    retryKey: "live-e2e-20260817-1904",
  }, "Bearer attacker"), {
    authorize: async () => ({ authorized: false }),
    cronSecret: () => {
      cronSecretRead = true;
      return "must-not-be-read";
    },
    acquisition: async () => {
      handlerCalled = true;
      return Response.json({});
    },
  });

  assert.equal(response.status, 401);
  assert.equal(cronSecretRead, false);
  assert.equal(handlerCalled, false);
  assert.deepEqual(await response.json(), { error: "Unauthorized manual Live trigger." });
});

test("invalid retry identities are rejected without invoking the pipeline", async () => {
  let handlerCalled = false;
  const response = await handleManualLiveTriggerWithDependencies(request({
    slot: "evening",
    stage: "acquisition",
    retryKey: "contains spaces",
  }), {
    authorize: authorized,
    cronSecret: () => "internal-cron-secret",
    acquisition: async () => {
      handlerCalled = true;
      return Response.json({});
    },
  });

  assert.equal(response.status, 400);
  assert.equal(handlerCalled, false);
});

test("responses and safe audit logs never contain either credential", async () => {
  const events: Array<Record<string, unknown>> = [];
  const response = await handleManualLiveTriggerWithDependencies(request({
    slot: "evening",
    stage: "acquisition",
    retryKey: "live-e2e-20260817-1904",
  }, "Bearer github-oidc-token"), {
    authorize: authorized,
    cronSecret: () => "internal-cron-secret",
    acquisition: async () => Response.json({ status: "intelligence_pending" }),
    logger: (event) => events.push(event),
  });
  const observable = JSON.stringify({ response: await response.json(), events });

  assert.doesNotMatch(observable, /github-oidc-token/);
  assert.doesNotMatch(observable, /internal-cron-secret/);
  assert.match(observable, /live-e2e-20260817-1904/);
});

test("the production route and workflow keep the canonical handlers and OIDC boundary explicit", () => {
  const route = readFileSync(new URL("../app/api/admin/research/run/route.ts", import.meta.url), "utf8");
  const handler = readFileSync(new URL("../lib/manual-live-trigger.ts", import.meta.url), "utf8");
  const workflow = readFileSync(new URL("../.github/workflows/run-live-research.yml", import.meta.url), "utf8");

  assert.match(route, /handleManualLiveTriggerWithDependencies/);
  assert.match(route, /handleScheduledResearchAcquisition/);
  assert.match(route, /handleScheduledResearchIntelligence/);
  assert.match(handler, /live-internal\.invalid\/api\/cron\/research/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /api\/admin\/research\/run/);
  assert.doesNotMatch(workflow, /RESEARCH_UPDATE_TOKEN/);
  assert.doesNotMatch(workflow, /CRON_SECRET/);
});
