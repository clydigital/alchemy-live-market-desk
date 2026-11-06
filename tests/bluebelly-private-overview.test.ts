import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { blueDeskHostAccess } from "../lib/blue-desk-host.ts";
import {
  BLUEBELLY_PRIVATE_OVERVIEW_V1,
  projectBluebellyPrivateOverview,
} from "../lib/bluebelly-private-overview.ts";

const id1 = "11111111-1111-4111-8111-111111111111";
const id2 = "22222222-2222-4222-8222-222222222222";
const selected = {
  status: "fallback_previous_healthy" as const,
  presentation: {},
  selectedDossierId: id1,
  selectedAsOf: "2026-10-22T23:15:00.000Z",
  latestDossierId: id2,
  latestAsOf: "2026-10-23T23:15:00.000Z",
  usingFallback: true,
};

test("private Bluebelly overview returns only canonical identity, selection and clocks", () => {
  const result = projectBluebellyPrivateOverview(selected);
  assert.equal(result.contractVersion, BLUEBELLY_PRIVATE_OVERVIEW_V1);
  assert.equal(result.availability, "AVAILABLE");
  assert.equal(result.selectedDossierId, id1);
  assert.equal(result.latestDossierId, id2);
  assert.equal(result.usingFallback, true);
  assert.deepEqual(Object.keys(result).sort(), [
    "authority", "availability", "contractVersion", "latestAsOf",
    "latestDossierId", "selectedAsOf", "selectedDossierId",
    "selectionStatus", "usingFallback",
  ].sort());
});

test("missing or malformed canonical selection fails closed, not latest fallback", () => {
  const missing = projectBluebellyPrivateOverview({
    ...selected, presentation: null,
  });
  assert.equal(missing.availability, "UNAVAILABLE");
  assert.equal(missing.selectedDossierId, null);
  assert.equal(missing.selectedAsOf, null);
  assert.equal(missing.usingFallback, false);

  const malformed = projectBluebellyPrivateOverview({
    ...selected, selectedDossierId: "not-a-uuid", selectedAsOf: "invalid-date",
  });
  assert.equal(malformed.availability, "UNAVAILABLE");
  assert.equal(malformed.selectedDossierId, null);
  assert.equal(malformed.selectedAsOf, null);
});

test("overview cannot be served from the public Bluebelly hostname", () => {
  const route = "/api/owner/bluebelly/v1/overview";
  assert.equal(blueDeskHostAccess(route, "bluebelly-desk.vercel.app"), "blocked");
  assert.equal(blueDeskHostAccess(route, "alchemy-live-market-desk.vercel.app"), "private");

  const implementation = readFileSync(
    new URL("../app/api/owner/bluebelly/v1/overview/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(implementation, /client\.auth\.getUser\(\)/);
  assert.match(implementation, /app_access_allowlist/);
  assert.match(implementation, /blueDeskHostAccess/);
  assert.match(implementation, /private, no-store/);
  assert.doesNotMatch(implementation, /Access-Control-Allow-Origin|SUPABASE_SERVICE_ROLE_KEY|authorization\s*:/);
});
