import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assessRawConsumerCutover, LEGACY_EVIDENCE_UNAPPROVED_FIELDS,
  RAW_LEGACY_TABLES, REQUIRED_RAW_CUTOVER_PROOFS, summariseLegacyEvidenceExposure,
} from "../lib/blue-desk-raw-consumer-cutover-gate.ts";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("P-1 gate never deems raw evidence anon revocation ready on a partial proof", () => {
  assert.deepEqual([...RAW_LEGACY_TABLES], ["evidence", "research_source_registry", "research_schedule_slots"]);
  assert.equal(REQUIRED_RAW_CUTOVER_PROOFS.length, 10);
  assert.equal(assessRawConsumerCutover({}).status, "BLOCKED");
  const complete = Object.fromEntries(REQUIRED_RAW_CUTOVER_PROOFS.map(key => [key, true]));
  assert.equal(assessRawConsumerCutover(complete).status, "READY_FOR_AUTHORISED_REVIEW");
  for (const key of REQUIRED_RAW_CUTOVER_PROOFS) {
    const candidate = { ...complete, [key]: false };
    const assessment = assessRawConsumerCutover(candidate);
    assert.equal(assessment.status, "BLOCKED", key);
    assert.deepEqual(assessment.missing, [key]);
  }
  assert.equal(assessRawConsumerCutover({ ...complete, hybridReadersMigrated: undefined }).status, "BLOCKED");
});

test("legacy Evidence rows yield counts only, never unintended content or publication approval", () => {
  const raw = [{
    id: "e1", story_id: "s1", source_id: null, is_active: true,
    detail: "unapproved sensitive details", claim: "sensitive claim",
    ai_price_reason: "unreviewed pricing thesis", chart_series: ["private-point"],
    judged_asset: "unapproved position",
  }, {
    id: "e2", story_id: "s2", source_id: "source2", is_active: false,
    claim: "example", ai_price_reason: "", detail: "context", chart_series: [],
  }];
  const summary = summariseLegacyEvidenceExposure(raw);
  assert.deepEqual(summary, {
    totalRows: 2, activeRows: 1, rowsWithoutSourceId: 1,
    rowsWithAIPriceReason: 1, rowsWithDetail: 2, rowsWithChartSeries: 1,
    publicationApproved: false,
  });
  const text = JSON.stringify(summary);
  for (const secret of ["sensitive", "private-point", "unapproved position", "pricing thesis"]) {
    assert.ok(!text.includes(secret), secret);
  }
  for (const field of LEGACY_EVIDENCE_UNAPPROVED_FIELDS) {
    assert.ok(!Object.hasOwn(summary, field));
  }
});

test("Live reader migration does not imply Hybrid or DB grant cutover has finished", () => {
  const live = read("lib/data.ts");
  const migration = read("supabase/migrations/20261019222435_blue_desk_legacy_public_tables_read_only_20261020.sql");
  assert.match(live, /privateQuery<StoryEvidence>\("evidence",/);
  assert.doesNotMatch(live, /(?<!private)query<StoryEvidence>\("evidence",/);
  assert.match(live, /privateQuery<ResearchRegistryItem>\("research_source_registry",/);
  // This existing migration removes writes only; SELECT must stay until both
  // independently deployed consumers are proven to use an authorised projection.
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE/);
  assert.doesNotMatch(migration, /REVOKE[^;]*SELECT|DROP POLICY/i);
  const docs = read("docs/blue-desk/P_MINUS_1_RAW_READERS_AND_PERMISSION_PROOF_20261023.md");
  assert.match(docs, /clydigital\/alchemy-hybrid-market-desk/);
  assert.match(docs, /lib\/data\.js/);
  assert.match(docs, /getPulseData/);
  assert.match(docs, /Hold: no anon SELECT revoke/);
});
