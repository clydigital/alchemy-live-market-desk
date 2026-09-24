import test from "node:test";
import assert from "node:assert/strict";

import { buildCandidateSnapshotFromCanonicalEvidence } from "../lib/dossier-v2/canonical-snapshot.ts";
import { assembleDossierV2InputPacket } from "../lib/dossier-v2/input-packet.ts";

const AS_OF = "2026-09-24T06:00:00.000Z";

test("canonical snapshot ranks primary evidence ahead of newer secondary market context", () => {
  const result = buildCandidateSnapshotFromCanonicalEvidence([
    {
      id: "news-1",
      external_evidence_id: "ev-news",
      claim_text: "US 10-year Treasury yields rose 12 bps to 5.10% in Thursday trading.",
      summary: "Treasury yields rose as markets repriced the rates outlook.",
      evidence_class: "news_report",
      published_at: "2026-09-24T05:30:00.000Z",
      available_at: "2026-09-24T05:31:00.000Z",
      affected_topics: ["rates"],
      affected_assets: ["US10Y"],
      source: {
        id: "src-news",
        source_name: "High quality wire",
        source_type: "article",
        source_url: "https://example.com/news",
        source_tier: 2,
        reliability_score: 85,
      },
    },
    {
      id: "official-1",
      external_evidence_id: "ev-official",
      claim_text: "The official release reported the benchmark rate observation for the rates cluster.",
      evidence_class: "official_release",
      published_at: "2026-09-24T04:00:00.000Z",
      available_at: "2026-09-24T04:01:00.000Z",
      affected_topics: ["rates"],
      affected_assets: ["US10Y"],
      source: {
        id: "src-official",
        source_name: "Official agency",
        source_type: "official",
        source_url: "https://example.gov/release",
        source_tier: 1,
        reliability_score: 96,
      },
    },
  ], { asOf: AS_OF, lookbackHours: 24 });

  const raw = result.snapshot.observed_evidence || [];
  const news = raw.find((item) => item.evidence_id === "ev-news");
  const official = raw.find((item) => item.evidence_id === "ev-official");

  assert.equal(typeof news?.rank, "number");
  assert.equal(typeof official?.rank, "number");
  assert.ok(Number(official?.rank) < Number(news?.rank));

  const packet = assembleDossierV2InputPacket(
    { as_of: AS_OF, previous_dossier_id: null },
    result.snapshot,
  );

  const rates = packet.development_clusters.find((cluster) => cluster.grouping_key === "rates");
  assert.ok(rates);
  assert.equal(rates.evidence[0].evidence_id, "ev-official");
  assert.equal(rates.evidence[1].evidence_id, "ev-news");
});
