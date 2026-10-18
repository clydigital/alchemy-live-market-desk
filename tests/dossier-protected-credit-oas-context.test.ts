import assert from "node:assert/strict";
import test from "node:test";
import { assembleDossierV2InputPacket } from "../lib/dossier-v2/input-packet.ts";

const AS_OF = "2026-10-18T12:00:00.000Z";
const AVAILABLE = "2026-10-16T18:15:21.151Z";
const OBSERVED = "2026-10-15T23:59:59.999Z";
const SPEC = [
  { family: "hy_oas_20s", url: "https://fred.stlouisfed.org/series/BAMLH0A0HYM2", value: 53 },
  { family: "ig_oas_20s", url: "https://fred.stlouisfed.org/series/BAMLC0A0CM", value: 6 },
] as const;

function row(spec: typeof SPEC[number], overrides: Record<string,unknown> = {}) {
  return {
    evidence_id: `market-crack:${spec.family}:2026-09-17:2026-10-15`,
    claim_or_fact: `${spec.family} measured a ${spec.value} bp spread-level change over 20 matched sessions through 2026-10-15. No causal attribution.`,
    canonical_record_backed: true,
    source_type: "MARKET_DATA", category: "Credit / Risk",
    grouping_key: "us-china-ai", available_at: AVAILABLE,
    occurrence_time: OBSERVED, rank: 42,
    provenance: [{source_type:"MARKET_DATA",source_id:`market-crack:${spec.family}`,url:spec.url}],
    ...overrides,
  };
}
function packet(rows: Array<Record<string,unknown>>, asOf = AS_OF) {
  return assembleDossierV2InputPacket(
    {as_of: asOf,previous_dossier_id:null},
    {observed_evidence:rows},
  );
}

test("canonical FRED/ICE HY and IG OAS survive 24h window as bounded dated diagnostics", () => {
  const out = packet(SPEC.map(s=>row(s)));
  assert.equal(out.observed_evidence.length,2);
  assert.deepEqual(
    out.observed_evidence.map(x=>x.evidence_id).sort(),
    SPEC.map(s=>`market-crack:${s.family}:2026-09-17:2026-10-15`).sort(),
  );
  for(const e of out.observed_evidence){
    assert.equal(e.available_at,AVAILABLE);
    assert.equal(e.occurrence_time,OBSERVED);
    assert.equal(e.canonical_record_backed,true);
    assert.equal(e.metrics?.interpretation_authority,"diagnostic_only");
  }
});

test("never grant a historical exemption to fake, misattributed or stale OAS", () => {
  const good = row(SPEC[0]);
  const invalid = [
    row(SPEC[0], {canonical_record_backed:false}),
    row(SPEC[0], {source_type:"RESEARCH_LEAD"}),
    row(SPEC[0], {provenance:[{source_type:"MARKET_DATA",source_id:"fake",url:"https://example.net/fred"}]}),
    row(SPEC[0], {occurrence_time:"2026-10-09T23:59:59.999Z"}),
    row(SPEC[0], {evidence_id:"market-crack:hy_oas_20s:2026-09-17:2026-10-14"}),
  ];
  for(const rejected of invalid){
    assert.equal(packet([rejected]).observed_evidence.length,0);
  }
  assert.equal(packet([good],"2026-10-23T12:00:00.000Z").observed_evidence.length,0);
});

test("only latest qualified HY/IG vintages survive; do not count duplicate source as two independent proofs", () => {
  const hyOlder = row(SPEC[0], {
    evidence_id:"market-crack:hy_oas_20s:2026-09-16:2026-10-14",
    occurrence_time:"2026-10-14T23:59:59.999Z",
    available_at:"2026-10-15T18:15:21.151Z",
  });
  const out = packet([hyOlder,...SPEC.map(s=>row(s))]);
  assert.equal(out.observed_evidence.filter(e=>e.evidence_id.startsWith("market-crack:hy_oas")).length,1);
  assert.equal(out.observed_evidence.filter(e=>e.evidence_id.startsWith("market-crack:ig_oas")).length,1);
  assert.ok(out.diagnostics.notes.some(note=>note.includes("diagnostic credit context")));
});
