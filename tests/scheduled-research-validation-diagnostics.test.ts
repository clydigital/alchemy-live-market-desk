import assert from "node:assert/strict";
import test from "node:test";

import { scheduledResearchValidationFailureDetail } from "../lib/scheduled-research-validation-diagnostics.ts";

test("scheduled validator failure is recorded with fixed field categories and bounded counts", () => {
  const publicUrl = "https://private-source.example.com?token=secret_value";
  const detail = scheduledResearchValidationFailureDetail({
    error: "Research run validation failed.",
    errors: [
      "items[0].articlePosition must be from 1 to 30.",
      "items[1].articlePosition must be from 1 to 30.",
      "Missing source check: axios.",
      `items[3].url must be HTTPS. ${publicUrl}`,
      `Untrusted upstream error: ${publicUrl}`,
    ],
  });
  assert.equal(
    detail,
    "Research run validation failed (5 issue(s)): source_checks=1, item_url=1, article_position=2, other_validation=1.",
  );
  assert.ok(!detail.includes(publicUrl));
  assert.ok(!detail.includes("token"));
  assert.ok(!detail.includes("secret_value"));
});

test("malformed publisher payload cannot inject free-form text into the failed-run ledger", () => {
  for (const payload of [
    null,
    { error: "https://private.example.com/sensitive" },
    { errors: "https://private.example.com/sensitive" },
    [ "untrusted" ],
  ]) {
    assert.equal(
      scheduledResearchValidationFailureDetail(payload),
      "Research run validation failed (reason categories unavailable).",
    );
  }
});

test("large validator result stays bounded and does not echo arbitrary strings", () => {
  const result = scheduledResearchValidationFailureDetail({
    errors: Array.from({ length: 900 }, (_, index) => `https://untrusted.example/?secret=${index}`),
  });
  assert.equal(result, "Research run validation failed (250 issue(s)+): other_validation=250.");
  assert.ok(result.length < 160);
});
