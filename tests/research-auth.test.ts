import assert from "node:assert/strict";
import test from "node:test";

import { acceptsResearchAuthorization } from "../lib/research-auth.ts";

test("accepts either the manual research token or Vercel Cron secret", () => {
  assert.equal(acceptsResearchAuthorization("Bearer manual-token", ["manual-token", "cron-token"]), true);
  assert.equal(acceptsResearchAuthorization("Bearer cron-token", ["manual-token", "cron-token"]), true);
});

test("rejects missing, malformed and unmatched bearer tokens", () => {
  assert.equal(acceptsResearchAuthorization(null, ["manual-token", "cron-token"]), false);
  assert.equal(acceptsResearchAuthorization("Bearer wrong", ["manual-token", "cron-token"]), false);
  assert.equal(acceptsResearchAuthorization("Basic cron-token", ["manual-token", "cron-token"]), false);
});
