import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  classifyStoryReasoningAction,
} from "../lib/story-reasoning-work-status.ts";

test("reasoning gaps distinguish queued review from evidence/routing states", () => {
  assert.equal(classifyStoryReasoningAction({
    pendingReviewCount: 2,
    lastEvidenceAt: "2026-10-07T13:00:00.000Z",
    lastEvaluatedAt: "2026-10-07T12:00:00.000Z",
  }), "queued_review");

  assert.equal(classifyStoryReasoningAction({
    pendingReviewCount: 0,
    lastEvidenceAt: "2026-10-07T12:00:00.000Z",
    lastEvaluatedAt: "2026-10-07T13:00:00.000Z",
  }), "waiting_new_evidence");

  assert.equal(classifyStoryReasoningAction({
    pendingReviewCount: 0,
    lastEvidenceAt: null,
    lastEvaluatedAt: "2026-10-07T13:00:00.000Z",
  }), "no_canonical_evidence");

  assert.equal(classifyStoryReasoningAction({
    pendingReviewCount: 0,
    lastEvidenceAt: "2026-10-07T14:00:00.000Z",
    lastEvaluatedAt: "2026-10-07T13:00:00.000Z",
  }), "needs_routing_check");
});

test("Story reasoning work status remains a read-only diagnostic", () => {
  const source = readFileSync(
    new URL("../lib/story-reasoning-work-status.ts", import.meta.url),
    "utf8",
  );
  const page = readFileSync(
    new URL("../app/stories/page.tsx", import.meta.url),
    "utf8",
  );
  const registry = readFileSync(
    new URL("../components/live-desk/StoriesRegistry.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /intelligence_story_states/);
  assert.match(source, /intelligence_reevaluation_queue/);
  assert.doesNotMatch(source, /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/);

  assert.match(page, /Queued full reviews/);
  assert.match(page, /Waiting on evidence/);
  assert.match(page, /Routing checks/);
  assert.match(registry, /Queued reasoning/);
  assert.match(registry, /Waiting evidence/);
  assert.match(registry, /maintenance-only refresh cannot manufacture V1 reasoning/);
});
