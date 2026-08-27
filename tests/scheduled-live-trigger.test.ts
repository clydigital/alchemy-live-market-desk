import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { JWTPayload } from "jose";

import {
  acceptsManualLiveTriggerClaims,
  acceptsScheduledLiveTriggerClaims,
} from "../lib/manual-live-trigger-auth.ts";
import { handleScheduledLiveTriggerWithDependencies } from "../lib/scheduled-live-trigger.ts";

const trustedBase = {
  sub: "repo:clydigital@184374203/alchemy-live-market-desk@1317040018:ref:refs/heads/main",
  repository: "clydigital/alchemy-live-market-desk",
  repository_id: "1317040018",
  workflow_ref: "clydigital/alchemy-live-market-desk/.github/workflows/run-live-research.yml@refs/heads/main",
  workflow_sha: "abc123",
  ref: "refs/heads/main",
  ref_type: "branch",
  actor: "github-actions",
  run_id: "123456",
} satisfies JWTPayload;

const scheduledAuthorized = async () => ({
  authorized: true as const,
  actor: "github-actions",
  githubRunId: "123456",
  workflowSha: "abc123",
  eventName: "schedule" as const,
});

function request(body: unknown) {
  return new Request("https://example.com/api/admin/research/scheduled-run", {
    method: "POST",
    headers: {
      authorization: "Bearer short-lived-oidc-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

test("manual and scheduled GitHub OIDC events stay on separate trusted claim paths", () => {
  const manual = { ...trustedBase, event_name: "workflow_dispatch" } as JWTPayload;
  const scheduled = { ...trustedBase, event_name: "schedule" } as JWTPayload;

  assert.equal(acceptsManualLiveTriggerClaims(manual), true);
  assert.equal(acceptsScheduledLiveTriggerClaims(manual), false);
  assert.equal(acceptsManualLiveTriggerClaims(scheduled), false);
  assert.equal(acceptsScheduledLiveTriggerClaims(scheduled), true);
});

test("scheduled acquisition preserves the canonical run identity with no retry query", async () => {
  let canonicalUrl = "";
  let canonicalSlot = "";
  const response = await handleScheduledLiveTriggerWithDependencies(request({
    slot: "morning",
    stage: "acquisition",
  }), {
    authorize: scheduledAuthorized,
    cronSecret: () => "internal-cron-secret",
    acquisition: async (canonicalRequest, slot) => {
      canonicalUrl = canonicalRequest.url;
      canonicalSlot = slot;
      return Response.json({ status: "intelligence_pending" });
    },
    logger: () => undefined,
  });

  assert.equal(response.status, 200);
  assert.equal(canonicalSlot, "morning");
  assert.equal(canonicalUrl, "https://live-internal.invalid/api/cron/research/morning");
  assert.doesNotMatch(canonicalUrl, /retry=/);
});

test("scheduled intelligence uses the same canonical identity and internal credential boundary", async () => {
  let canonicalRequest: Request | null = null;
  const response = await handleScheduledLiveTriggerWithDependencies(request({
    slot: "evening",
    stage: "intelligence",
  }), {
    authorize: scheduledAuthorized,
    cronSecret: () => "internal-cron-secret",
    intelligence: async (incoming) => {
      canonicalRequest = incoming;
      return Response.json({ status: "completed", runId: "run-1" });
    },
    logger: () => undefined,
  });

  assert.equal(response.status, 200);
  assert.equal(canonicalRequest?.url, "https://live-internal.invalid/api/cron/research/evening");
  assert.equal(canonicalRequest?.headers.get("authorization"), "Bearer internal-cron-secret");
  assert.equal(canonicalRequest?.headers.get("x-alchemy-scheduled-trigger"), "github-actions-oidc");
});

test("scheduled video maps the desk slot to the dedicated 15-minute preflight slot", async () => {
  let forcedSlot = "";
  const response = await handleScheduledLiveTriggerWithDependencies(request({
    slot: "evening",
    stage: "video",
  }), {
    authorize: scheduledAuthorized,
    cronSecret: () => "internal-cron-secret",
    video: async (_incoming, slot) => {
      forcedSlot = slot || "";
      return Response.json({ status: "completed" });
    },
    logger: () => undefined,
  });

  assert.equal(response.status, 200);
  assert.equal(forcedSlot, "video_late_morning");
});

test("unauthorised scheduled requests cannot read the internal credential", async () => {
  let cronSecretRead = false;
  const response = await handleScheduledLiveTriggerWithDependencies(request({
    slot: "morning",
    stage: "acquisition",
  }), {
    authorize: async () => ({ authorized: false }),
    cronSecret: () => {
      cronSecretRead = true;
      return "must-not-be-read";
    },
  });

  assert.equal(response.status, 401);
  assert.equal(cronSecretRead, false);
});

test("workflow schedules primary and rescue passes well before the 10am and 10pm SLA", () => {
  const workflow = readFileSync(new URL("../.github/workflows/run-live-research.yml", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/admin/research/scheduled-run/route.ts", import.meta.url), "utf8");

  assert.match(workflow, /cron: "45 0 \* \* \*"/);
  assert.match(workflow, /cron: "30 1 \* \* \*"/);
  assert.match(workflow, /cron: "45 12 \* \* \*"/);
  assert.match(workflow, /cron: "30 13 \* \* \*"/);
  assert.match(workflow, /api\/admin\/research\/scheduled-run/);
  assert.match(workflow, /for attempt in \{1\.\.10\}/);
  assert.match(workflow, /sleep 15/);
  assert.match(workflow, /video_lead_epoch=\$\(\(video_started_at \+ 900\)\)/);
  assert.match(route, /handleScheduledLiveTriggerWithDependencies/);
  assert.match(route, /handleVideoIntakeRequest/);
  assert.match(route, /handleScheduledResearchAcquisition/);
  assert.match(route, /handleScheduledResearchIntelligence/);
});
