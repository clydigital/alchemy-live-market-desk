import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { presenterPrepHref } from "../lib/presenter-prep-navigation.ts";

test("historical Journey link retains edition and every source focus", () => {
  const target = presenterPrepHref("/hybrid-output",
    "edition=old-snapshot&story=rates&motion=motion-7&regime=us-rate-regime&event=event-1&tab=other");
  assert.equal(target, "/hybrid-output/prepare?edition=old-snapshot&story=rates&motion=motion-7&regime=us-rate-regime&event=event-1");
});

test("non-Journey pages do not leak unrelated filters into Presenter Prep", () => {
  assert.equal(presenterPrepHref("/", "edition=wrong&story=wrong"), "/hybrid-output/prepare");
  assert.equal(presenterPrepHref("/hybrid-output", ""), "/hybrid-output/prepare");
  assert.equal(presenterPrepHref("/hybrid-output/prepare", "edition=old"), "/hybrid-output/prepare?edition=old");
});

test("ambiguous duplicate edition parameters are preserved for fail-closed handling", () => {
  const result = presenterPrepHref("/hybrid-output", "edition=old&edition=new&story=rates");
  assert.equal(new URL(result, "https://test.invalid").searchParams.getAll("edition").length, 2);
});

test("shell navigation is bound to URL state without modifying original Journey", () => {
  const shell = readFileSync(new URL("../components/live-desk/LiveDeskShell.tsx", import.meta.url), "utf8");
  const client = readFileSync(new URL("../components/live-desk/PresenterPrepNavigationLink.tsx", import.meta.url), "utf8");
  assert.match(shell, /<PresenterPrepNavigationLink/);
  assert.match(shell, /<Suspense/);
  assert.match(client, /useSearchParams/);
  assert.match(client, /presenterPrepHref\(activePath, searchParams\.toString\(\)\)/);
});
