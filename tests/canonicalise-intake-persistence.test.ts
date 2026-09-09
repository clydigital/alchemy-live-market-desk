import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const stagingUrl = process.env.ALCHEMY_STAGING_SUPABASE_URL;
const stagingServiceKey = process.env.ALCHEMY_STAGING_SUPABASE_SERVICE_ROLE_KEY;
const writesEnabled = process.env.ALCHEMY_STAGING_ALLOW_WRITES === "1";

type JsonRow = Record<string, unknown>;

test("canonicaliseIntake persists conservative Story links and replay diagnostics", async (t) => {
  if (!stagingUrl || !stagingServiceKey || !writesEnabled) {
    t.skip("requires an explicitly write-enabled staging Supabase environment");
    return;
  }
  assert.doesNotMatch(stagingUrl, /qdtlrfgxpsnxajiptrno/i, "refusing to run the persistence fixture against production");

  process.env.NEXT_PUBLIC_SUPABASE_URL = stagingUrl;
  process.env.SUPABASE_SERVICE_ROLE_KEY = stagingServiceKey;
  const { canonicaliseIntake } = await import("../lib/intelligence/runtime.ts");

  const rest = async <T>(path: string, init: RequestInit = {}) => {
    const response = await fetch(`${stagingUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: stagingServiceKey,
        Authorization: `Bearer ${stagingServiceKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    if (!response.ok) throw new Error(`Staging persistence fixture failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
    if (response.status === 204) return undefined as T;
    const body = await response.text();
    return (body ? JSON.parse(body) : undefined) as T;
  };

  const token = randomUUID();
  const runId = randomUUID();
  const fedStoryId = randomUUID();
  const durationStoryAId = randomUUID();
  const durationStoryBId = randomUUID();
  const relevantId = randomUUID();
  const irrelevantId = randomUUID();
  const ambiguousId = randomUUID();
  const publishedAt = new Date().toISOString();
  const publisher = `Stabilisation Fixture ${token}`;
  const publisherSlug = publisher.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72);
  const testDomain = `stabilisation-${token}.invalid`;
  const sourceExternalId = `${testDomain}|${publisherSlug}`;
  const storyIds = [fedStoryId, durationStoryAId, durationStoryBId];
  const intakeIds = [relevantId, irrelevantId, ambiguousId];
  let evidenceRows: JsonRow[] = [];

  const stories = [
    {
      id: fedStoryId,
      slug: `stabilisation-fed-${token}`,
      title: "Federal Reserve disinflation policy hold",
      thesis: "Disinflation allows the Federal Reserve to hold policy rates.",
      status: "monitor",
      confidence: 70,
      market_question: null,
      dominant_narrative: null,
      strongest_support: null,
      strongest_contradiction: null,
      confirmation_trigger: null,
      invalidation_trigger: null,
      next_catalyst: null,
      assets: ["USD", "SPX"],
      article_verdict: "research_engine",
    },
    ...[durationStoryAId, durationStoryBId].map((id, index) => ({
      id,
      slug: `stabilisation-duration-${index}-${token}`,
      title: "Treasury term premium duration demand",
      thesis: "Duration demand changes the Treasury term premium.",
      status: "monitor",
      confidence: 60,
      market_question: null,
      dominant_narrative: null,
      strongest_support: null,
      strongest_contradiction: null,
      confirmation_trigger: null,
      invalidation_trigger: null,
      next_catalyst: null,
      assets: ["US10Y"],
      article_verdict: index === 0 ? "theme_seed_unverified" : "research_engine",
    })),
  ];

  const intake = [
    {
      id: relevantId,
      run_id: runId,
      item_key: `stabilisation:relevant:${token}`,
      item_type: "news",
      publisher,
      title: "USD SPX Federal Reserve disinflation policy hold",
      url: `https://${testDomain}/relevant`,
      published_at: publishedAt,
      transcript_status: "not_applicable",
      summary: "Federal Reserve officials reinforced a policy hold as disinflation continued across USD and SPX.",
      affected_story_slugs: [],
      source_quality: 80,
      relevance: 82,
      novelty: 60,
      materiality: 64,
      candidate_score: 72,
      recommended_action: "collect_evidence",
      status: "accepted",
      divergence_kind: "none",
      evidence_links: [],
    },
    {
      id: irrelevantId,
      run_id: runId,
      item_key: `stabilisation:irrelevant:${token}`,
      item_type: "news",
      publisher,
      title: "Generic USD SPX market commentary",
      url: `https://${testDomain}/irrelevant`,
      published_at: publishedAt,
      transcript_status: "not_applicable",
      summary: "USD and SPX prices moved during ordinary trading and broad market commentary.",
      affected_story_slugs: [],
      source_quality: 70,
      relevance: 40,
      novelty: 30,
      materiality: 64,
      candidate_score: 45,
      recommended_action: "monitor",
      status: "accepted",
      divergence_kind: "none",
      evidence_links: [],
    },
    {
      id: ambiguousId,
      run_id: runId,
      item_key: `stabilisation:ambiguous:${token}`,
      item_type: "news",
      publisher,
      title: "US10Y Treasury term premium repricing",
      url: `https://${testDomain}/ambiguous`,
      published_at: publishedAt,
      transcript_status: "not_applicable",
      summary: "Treasury term premium repricing changed duration demand in US10Y.",
      affected_story_slugs: [],
      source_quality: 80,
      relevance: 75,
      novelty: 65,
      materiality: 64,
      candidate_score: 68,
      recommended_action: "collect_evidence",
      status: "accepted",
      divergence_kind: "none",
      evidence_links: [],
    },
  ];
  const fixtureItemKeys = new Set(intake.map((item) => item.item_key));

  try {
    await rest("stories", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(stories.map((story) => ({
        id: story.id,
        slug: story.slug,
        title: story.title,
        thesis: story.thesis,
        status: story.status,
        confidence: story.confidence,
        assets: story.assets,
        article_verdict: story.article_verdict,
      }))),
    });
    await rest("research_runs", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ id: runId, run_key: `stabilisation-${token}`, schedule_slot: "manual", scheduled_for: publishedAt }),
    });
    await rest("research_intake_items", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(intake),
    });

    await canonicaliseIntake(stories, fixtureItemKeys);
    evidenceRows = await rest<JsonRow[]>(
      `intelligence_evidence?select=id,external_evidence_id,structured_payload,raw_source_record_id,normalised_observation_id,source_id&research_run_id=eq.${runId}`,
    );
    assert.equal(evidenceRows.length, 3, "all three intake items must become database-visible canonical Evidence");

    const evidenceByExternalId = new Map(evidenceRows.map((row) => [row.external_evidence_id, row]));
    const relevantEvidence = evidenceByExternalId.get(`research-intake:${relevantId}`)!;
    const irrelevantEvidence = evidenceByExternalId.get(`research-intake:${irrelevantId}`)!;
    const ambiguousEvidence = evidenceByExternalId.get(`research-intake:${ambiguousId}`)!;
    assert.ok(relevantEvidence && irrelevantEvidence && ambiguousEvidence);

    const evidenceIds = evidenceRows.map((row) => String(row.id));
    const links = await rest<JsonRow[]>(
      `intelligence_story_evidence?select=story_id,evidence_id,evidence_role&evidence_id=in.(${evidenceIds.join(",")})`,
    );
    assert.deepEqual(links, [{ story_id: fedStoryId, evidence_id: relevantEvidence.id, evidence_role: "context" }]);

    const irrelevantLinks = links.filter((link) => link.evidence_id === irrelevantEvidence.id);
    const ambiguousLinks = links.filter((link) => link.evidence_id === ambiguousEvidence.id);
    assert.equal(irrelevantLinks.length, 0);
    assert.equal(ambiguousLinks.length, 0);
    assert.deepEqual(
      (ambiguousEvidence.structured_payload as JsonRow).storyRouting,
      {
        outcome: "unresolved",
        reason: "ambiguous_story_match",
        initialAssetRouteEligible: false,
        storyLocalEscalationEligible: false,
        candidateStoryIds: [durationStoryAId, durationStoryBId].sort(),
        matchedStoryId: null,
        matchedStoryTerms: [],
      },
    );

    await canonicaliseIntake(stories, fixtureItemKeys);
    const replayLinks = await rest<JsonRow[]>(
      `intelligence_story_evidence?select=story_id,evidence_id,evidence_role&evidence_id=in.(${evidenceIds.join(",")})`,
    );
    assert.deepEqual(replayLinks, links, "replay must not create a duplicate Story-Evidence link");
    const replayEvidence = await rest<JsonRow[]>(
      `intelligence_evidence?select=id&research_run_id=eq.${runId}`,
    );
    assert.deepEqual(
      replayEvidence.map((row) => row.id).sort(),
      [...evidenceIds].sort(),
      "replay must retain the same three canonical Evidence identities",
    );
  } finally {
    const evidenceIds = evidenceRows.map((row) => String(row.id));
    const observationIds = evidenceRows.map((row) => row.normalised_observation_id).filter(Boolean).map(String);
    const rawRecordIds = evidenceRows.map((row) => row.raw_source_record_id).filter(Boolean).map(String);
    const sourceIds = evidenceRows.map((row) => row.source_id).filter(Boolean).map(String);
    if (evidenceIds.length) {
      await rest(`intelligence_story_evidence?evidence_id=in.(${evidenceIds.join(",")})`, { method: "DELETE" });
      await rest(`intelligence_evidence?id=in.(${evidenceIds.join(",")})`, { method: "DELETE" });
    }
    if (observationIds.length) await rest(`normalised_observations?id=in.(${observationIds.join(",")})`, { method: "DELETE" });
    if (rawRecordIds.length) await rest(`raw_source_records?id=in.(${rawRecordIds.join(",")})`, { method: "DELETE" });
    await rest(`research_intake_items?id=in.(${intakeIds.join(",")})`, { method: "DELETE" });
    await rest(`research_runs?id=eq.${runId}`, { method: "DELETE" });
    await rest(`stories?id=in.(${storyIds.join(",")})`, { method: "DELETE" });
    if (sourceIds.length) await rest(`intelligence_evidence_sources?id=in.(${[...new Set(sourceIds)].join(",")})`, { method: "DELETE" });
    await rest(`intelligence_evidence_sources?provider_key=eq.research_intake&external_source_id=eq.${encodeURIComponent(sourceExternalId)}`, { method: "DELETE" });
    await rest(`intelligence_source_ancestry_groups?ancestry_key=eq.${encodeURIComponent(`domain:${testDomain}`)}`, { method: "DELETE" });
  }
});
