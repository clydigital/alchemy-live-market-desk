import assert from "node:assert/strict";
import test from "node:test";

import { promoteManualScheduledResearchAuthorization } from "../lib/scheduled-research-manual-auth.ts";

test("manual research token is promoted to the internal cron credential", () => {
  const request = new Request("https://example.com/api/cron/research/morning?retry=test-1", {
    headers: { authorization: "Bearer manual-token" },
  });

  const promoted = promoteManualScheduledResearchAuthorization(request, {
    manualToken: "manual-token",
    cronSecret: "cron-secret",
  });

  assert.equal(promoted.url, request.url);
  assert.equal(promoted.method, "GET");
  assert.equal(promoted.headers.get("authorization"), "Bearer cron-secret");
});

test("unknown credentials are never promoted", () => {
  const request = new Request("https://example.com/api/cron/research/morning", {
    headers: { authorization: "Bearer wrong-token" },
  });

  const promoted = promoteManualScheduledResearchAuthorization(request, {
    manualToken: "manual-token",
    cronSecret: "cron-secret",
  });

  assert.equal(promoted, request);
  assert.equal(promoted.headers.get("authorization"), "Bearer wrong-token");
});

test("bridge stays inert when either trusted credential is absent", () => {
  const request = new Request("https://example.com/api/cron/research/evening", {
    headers: { authorization: "Bearer manual-token" },
  });

  assert.equal(
    promoteManualScheduledResearchAuthorization(request, { manualToken: null, cronSecret: "cron-secret" }),
    request,
  );
  assert.equal(
    promoteManualScheduledResearchAuthorization(request, { manualToken: "manual-token", cronSecret: null }),
    request,
  );
});
