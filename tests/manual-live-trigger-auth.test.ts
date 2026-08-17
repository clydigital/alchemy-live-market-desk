import assert from "node:assert/strict";
import test from "node:test";

import { generateKeyPair, SignJWT } from "jose";

import {
  MANUAL_LIVE_TRIGGER_AUDIENCE,
  verifyGitHubActionsManualLiveTrigger,
} from "../lib/manual-live-trigger-auth.ts";

const issuer = "https://token.actions.githubusercontent.com";
const subject = "repo:clydigital@184374203/alchemy-live-market-desk@1317040018:ref:refs/heads/main";

async function signedRequest(overrides: Record<string, string> = {}) {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const claims = {
    repository: "clydigital/alchemy-live-market-desk",
    repository_id: "1317040018",
    workflow_ref: "clydigital/alchemy-live-market-desk/.github/workflows/run-live-research.yml@refs/heads/main",
    workflow_sha: "abc123",
    event_name: "workflow_dispatch",
    ref: "refs/heads/main",
    ref_type: "branch",
    actor: "production-operator",
    run_id: "123456",
    ...overrides,
  };
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: "test-key" })
    .setIssuer(issuer)
    .setAudience(MANUAL_LIVE_TRIGGER_AUDIENCE)
    .setSubject(subject)
    .setJti("unique-token-id")
    .setIssuedAt()
    .setNotBefore("-1s")
    .setExpirationTime("5m")
    .sign(privateKey);
  return {
    request: new Request("https://example.com/api/admin/research/run", {
      headers: { authorization: `Bearer ${token}` },
    }),
    publicKey,
  };
}

test("a signed token from the exact main workflow is authorised", async () => {
  const { request, publicKey } = await signedRequest();
  assert.deepEqual(await verifyGitHubActionsManualLiveTrigger(request, publicKey), {
    authorized: true,
    actor: "production-operator",
    githubRunId: "123456",
    workflowSha: "abc123",
  });
});

test("a valid GitHub token from any other workflow is rejected", async () => {
  const { request, publicKey } = await signedRequest({
    workflow_ref: "clydigital/alchemy-live-market-desk/.github/workflows/other.yml@refs/heads/main",
  });
  assert.deepEqual(await verifyGitHubActionsManualLiveTrigger(request, publicKey), {
    authorized: false,
  });
});

test("unsigned and malformed bearer values are rejected", async () => {
  const { publicKey } = await generateKeyPair("RS256");
  const request = new Request("https://example.com/api/admin/research/run", {
    headers: { authorization: "Bearer not-a-jwt" },
  });
  assert.deepEqual(await verifyGitHubActionsManualLiveTrigger(request, publicKey), {
    authorized: false,
  });
});
