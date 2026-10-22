import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { acceptsLegacyEvidenceRead, legacyEvidenceReadConfigured } from "../lib/blue-desk-legacy-evidence-auth.ts";
import { projectLegacyOwnerEvidence, LEGACY_EVIDENCE_COLUMNS } from "../lib/blue-desk-legacy-evidence-projection.ts";
import { MACHINE_AUTH_PATHS, PUBLIC_AUTH_PATHS } from "../lib/supabase/config.ts";
import { blueDeskHostAccess } from "../lib/blue-desk-host.ts";
const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const token = "private-legacy-evidence-review-only-token-20261023-abcdef";

test("private Evidence auth fails closed and rejects canonical, Dossier, cron, JWT and malformed credentials", () => {
  for (const missing of ["", undefined, null, "too-short", " ".repeat(34), "a".repeat(40) + " "]) {
    assert.equal(legacyEvidenceReadConfigured(missing), false);
  }
  assert.equal(legacyEvidenceReadConfigured(token), true);
  assert.equal(acceptsLegacyEvidenceRead("Bearer " + token, token), true);
  for (const authorization of [null, "", token, "Basic " + token, "bearer " + token,
    "Bearer " + token + " x", "Bearer wrong-synthetic-secret"]) {
    assert.equal(acceptsLegacyEvidenceRead(authorization, token), false);
  }
});

test("Evidence route is server-only, gated before privileged retrieval and denied on public hosts", () => {
  const route = read("app/api/internal/legacy-evidence/route.ts");
  const middleware = read("middleware.ts");
  assert.ok(MACHINE_AUTH_PATHS.includes("/api/internal/legacy-evidence" as never));
  assert.ok(!PUBLIC_AUTH_PATHS.includes("/api/internal/legacy-evidence" as never));
  for (const host of ["bluebelly-desk.vercel.app", "alchemy-blue-desk.vercel.app"]) {
    assert.equal(blueDeskHostAccess("/api/internal/legacy-evidence", host), "blocked");
  }
  assert.equal(blueDeskHostAccess("/api/internal/legacy-evidence", "alchemy-live-market-desk.vercel.app"), "private");
  assert.ok(route.indexOf("acceptsLegacyEvidenceRead(") < route.indexOf("getLegacyOwnerEvidenceRows()"));
  assert.match(route, /process\.env\.LIVE_HYBRID_LEGACY_EVIDENCE_READ_TOKEN/);
  assert.doesNotMatch(route, /LIVE_HYBRID_CANONICAL_FEED_READ_TOKEN|LIVE_HYBRID_DOSSIER_READ_TOKEN|CRON_SECRET/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
  assert.match(route, /"Vary": "Authorization"/);
  assert.doesNotMatch(route, /"Access-Control-Allow-Origin"|export async function POST|rawError|error\.message/);
  assert.match(middleware, /if \(accessScope === "blocked"\)/);
});

test("full owner legacy Evidence fields preserve UUIDs and EvidenceGame reviews, not raw DB columns", () => {
  const row = {
    id: "00000000-0000-4000-8000-000000000001",
    story_id: "00000000-0000-4000-8000-000000000002",
    source_id: null,
    evidence_type: "confirmed", claim: "Stored legacy claim",
    detail: "Stored legacy detail", strength: 72, created_at: "2026-10-01T00:00:00Z",
    ai_price_stance: "bullish", ai_price_reason: "Unreviewed analyst note",
    chart_series: ["spy"], judged_asset: "SPX", is_active: true, internal_debug: "never serialize",
  };
  const output = projectLegacyOwnerEvidence([row]);
  assert.equal(output.contractVersion, "legacy-owner-evidence/1");
  assert.equal(output.scope, "OWNER_PRIVATE_ONLY");
  assert.equal(output.sourceRights, "UNREVIEWED");
  assert.equal(output.evidenceKind, "LEGACY_NON_CANONICAL");
  assert.equal(output.unlinkedSourceCount, 1);
  assert.deepEqual(Object.keys(output.rows[0]!), [...LEGACY_EVIDENCE_COLUMNS]);
  assert.equal(output.rows[0]?.id, row.id);
  assert.equal(output.rows[0]?.story_id, row.story_id);
  assert.equal(output.rows[0]?.ai_price_reason, row.ai_price_reason);
  assert.deepEqual(output.rows[0]?.chart_series, ["spy"]);
  assert.ok(!JSON.stringify(output).includes("never serialize"));
  for (const invalid of [
    { ...row, id: "missing" }, { ...row, story_id: null },
    { ...row, is_active: false }, { ...row, chart_series: ["x", 22] },
    { ...row, claim: "" }, { ...row, source_id: "fake-id" },
  ]) assert.throws(() => projectLegacyOwnerEvidence([invalid]));
  assert.throws(() => projectLegacyOwnerEvidence([row, row]));
});

test("Live internal callers use the service-role read without SELECT* or anon fallback", () => {
  const live = read("lib/data.ts");
  assert.doesNotMatch(live, /query<StoryEvidence>\("evidence",/);
  assert.match(live, /privateQuery<StoryEvidence>\("evidence",/);
  assert.match(live, /privateQuery<ResearchRegistryItem>\("research_source_registry",/);
  assert.match(read("lib/blue-desk-legacy-evidence-projection.ts"), /cache: "no-store"/);
  assert.match(read("lib/blue-desk-legacy-evidence-projection.ts"), /LEGACY_EVIDENCE_COLUMNS\.join\(","\)/);
});
