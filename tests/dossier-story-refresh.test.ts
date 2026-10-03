import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import type { MarketDossierV2 } from "../lib/dossier-v2/contracts.ts";
import { assembleDossierV2InputPacket } from "../lib/dossier-v2/input-packet.ts";
import {
  RESEARCH_BRAIN_CONTRACT_VERSION,
  THESIS_LEDGER_V2_CONTRACT_VERSION,
  type MarketLens,
  type ResearchBrainOutputV1,
} from "../lib/dossier-v2/research-brain-contracts.ts";
import {
  buildDossierStoryRefreshAgenda,
  MAX_DOSSIER_STORY_REFRESH_TARGETS,
} from "../lib/dossier-v2/story-refresh-agenda.ts";

const AS_OF = "2026-09-22T06:00:00.000Z";
const FED_EVIDENCE_ID = "11111111-1111-4111-8111-111111111111";
const OIL_EVIDENCE_ID = "22222222-2222-4222-8222-222222222222";
const NOISE_EVIDENCE_ID = "33333333-3333-4333-8333-333333333333";

function packet() {
  return assembleDossierV2InputPacket(
    { as_of: AS_OF },
    {
      observed_evidence: [
        {
          evidence_id: FED_EVIDENCE_ID,
          available_at: "2026-09-22T05:30:00.000Z",
          claim_or_fact: "The Federal Reserve delivered a hawkish rate hike while front-end Treasury yields repriced higher.",
          category: "MONETARY_POLICY",
          source_type: "NEWS_REPORT",
          grouping_key: "fed-current",
          provenance: [{ source_type: "NEWS_REPORT", source_id: "fed-current" }],
        },
        {
          evidence_id: OIL_EVIDENCE_ID,
          available_at: "2026-09-22T05:31:00.000Z",
          claim_or_fact: "Oil and diesel remain tight as refinery and shipping constraints keep distillate cracks elevated.",
          category: "ENERGY",
          source_type: "NEWS_REPORT",
          grouping_key: "oil-current",
          provenance: [{ source_type: "NEWS_REPORT", source_id: "oil-current" }],
        },
        {
          evidence_id: NOISE_EVIDENCE_ID,
          available_at: "2026-09-22T05:32:00.000Z",
          claim_or_fact: "A software company announced a routine product refresh.",
          category: "COMPANY",
          source_type: "NEWS_REPORT",
          grouping_key: "noise-current",
          provenance: [{ source_type: "NEWS_REPORT", source_id: "noise-current" }],
        },
      ],
    },
  );
}

function dossierRecord(
  id: string,
  inputPacket: ReturnType<typeof packet>,
  analyticalOutput: ResearchBrainOutputV1,
  motionAttentionSnapshot: Array<Record<string, unknown>> = [],
): MarketDossierV2 {
  return {
    id,
    contract_version: "market-dossier-v2/1",
    previous_dossier_id: null,
    as_of: inputPacket.as_of,
    freshness: { warnings: [] },
    research_gaps: [],
    payload: {
      analytical_output: analyticalOutput,
      motion_attention_snapshot: motionAttentionSnapshot,
    },
    created_at: inputPacket.as_of,
  };
}

function output(inputPacket: ReturnType<typeof packet>): ResearchBrainOutputV1 {
  const lenses: Record<string, MarketLens> = {};
  for (const lensName of ["US_RATES", "BONDS", "TECH_AI", "OIL_WAR_INFLATION", "USD", "GOLD", "CREDIT", "BREADTH"]) {
    lenses[lensName] = {
      lens_name: lensName,
      observed_reaction: null,
      observed_reaction_evidence_refs: [],
      interpretation: "No additional lens detail.",
      contradiction_references: [],
      unresolved_signals: [],
    };
  }

  return {
    contract_version: RESEARCH_BRAIN_CONTRACT_VERSION,
    packet_id: inputPacket.packet_id,
    as_of: inputPacket.as_of,
    main_thread: {
      thread_id: "thread-current",
      headline: "Energy tightness and front-end Fed repricing define the current regime",
      answer: "Oil and distillate strength are colliding with a hawkish Fed and higher front-end yields.",
      regime_implication: "Inflation pressure and policy repricing remain the dominant cross-asset tension.",
      regime_family: "RATES_LED_TIGHTENING",
      epistemic_label: "SUPPORTED",
      evidence_references: [],
      supporting_story_ids: [],
      contradiction_references: [],
      what_would_change_mind: "A durable energy unwind and lower front-end yields.",
    },
    major_stories: [],
    chart_investigation_queue: { core: [], optional: [] },
    investigations: [
      {
        investigation_id: "invest-fed",
        question: "Is front-end policy repricing persistent after the hawkish Fed decision?",
        why_it_matters: "It sets the discount-rate pressure on risk assets.",
        current_explanation: "Treasury yields are repricing the near-term policy path.",
        expected_reaction: null,
        observed_reaction: null,
        divergence: "UNRESOLVED",
        competing_explanations: [],
        observed_evidence: [],
        missing_evidence: [],
        research_next: "Check the 2Y yield and fed funds curve.",
        chart_task_links: [],
        confirmation_condition: "2Y yields remain elevated.",
        invalidation_condition: "2Y yields reverse lower.",
        status: "open",
        linked_story_ids: [],
        linked_thesis_ids: [],
      },
      {
        investigation_id: "invest-oil",
        question: "Is distillate tightness durable?",
        why_it_matters: "Persistent refinery stress would keep energy inflation elevated.",
        current_explanation: "Oil and diesel supply constraints remain visible.",
        expected_reaction: null,
        observed_reaction: null,
        divergence: "UNRESOLVED",
        competing_explanations: [],
        observed_evidence: [],
        missing_evidence: [],
        research_next: "Check WTI, ULSD and crack spreads.",
        chart_task_links: [],
        confirmation_condition: "Distillate cracks remain elevated.",
        invalidation_condition: "Cracks compress materially.",
        status: "open",
        linked_story_ids: [],
        linked_thesis_ids: [],
      },
    ],
    market_verdict: {
      verdict_id: "verdict-current",
      lenses,
      cross_asset_readthrough: "Energy inflation and Fed repricing are the main regime drivers.",
      epistemic_label: "SUPPORTED",
      dominant_confirmation: "Energy and front-end rates remain elevated.",
      dominant_contradiction: "Long-end yields are less decisive.",
    },
    research_now: [],
    stock_radar: [],
    developing_themes: [],
    creator_theme_expansions: [],
    thesis_ledger: { contract_version: THESIS_LEDGER_V2_CONTRACT_VERSION, entries: [] },
    contradictions_detected: [],
    research_gaps: [],
    diagnostics: {
      degraded: false,
      degradation_reasons: [],
      omitted_or_demoted_items: [],
      missing_input_categories: [],
      model_repair_used: false,
      notes: [],
    },
  };
}

test("Dossier attention wakes matching archived Stories through canonical evidence topics", () => {
  const inputPacket = packet();
  const analyticalOutput = output(inputPacket);
  const agenda = buildDossierStoryRefreshAgenda({
    dossierId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    dossier: dossierRecord("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", inputPacket, analyticalOutput),
    packet: inputPacket,
    analyticalOutput,
    stories: [
      { id: "story-fed", slug: "fed-rate-repricing", title: "Fed rate repricing", thesis: "Front-end yields reprice as policy expectations change.", market_question: null, assets: ["US02Y"], status: "archived" },
      { id: "story-oil", slug: "refining-crack-spread-stress", title: "Refining crack spread stress", thesis: "Diesel and distillate supply tightness can keep refining cracks elevated.", market_question: null, assets: ["ULSD"], status: "archived" },
      { id: "story-noise", slug: "software-refresh", title: "Software refresh", thesis: "Routine software product updates.", market_question: null, assets: ["SOFT"], status: "archived" },
    ],
    evidenceRows: [
      { id: FED_EVIDENCE_ID, claim_text: "The Federal Reserve delivered a hawkish rate hike while front-end Treasury yields repriced higher.", summary: null, affected_topics: ["fed-rate-repricing"], affected_assets: ["US02Y"], evidence_class: "news_report" },
      { id: OIL_EVIDENCE_ID, claim_text: "Oil and diesel remain tight as refinery and shipping constraints keep distillate cracks elevated.", summary: null, affected_topics: ["refining-crack-spread-stress"], affected_assets: ["WTI", "ULSD"], evidence_class: "news_report" },
      { id: NOISE_EVIDENCE_ID, claim_text: "A software company announced a routine product refresh.", summary: null, affected_topics: ["software-refresh"], affected_assets: ["SOFT"], evidence_class: "news_report" },
    ],
    storyEvidenceLinks: [],
  });

  assert.deepEqual(agenda.map((item) => item.story_id).sort(), ["story-fed", "story-oil"]);
  assert.ok(agenda.every((item) => item.story_status === "archived"));
  assert.ok(agenda.every((item) => item.match_basis === "affected_story_slug"));
  assert.ok(agenda.every((item) => item.reason.startsWith("dossier_refresh:")));
});

test("explicit Dossier evidence can wake a linked Story even without lexical overlap", () => {
  const inputPacket = packet();
  const analyticalOutput = output(inputPacket);
  analyticalOutput.main_thread.evidence_references = [NOISE_EVIDENCE_ID];

  const agenda = buildDossierStoryRefreshAgenda({
    dossierId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    dossier: dossierRecord("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", inputPacket, analyticalOutput),
    packet: inputPacket,
    analyticalOutput,
    stories: [
      { id: "story-linked", slug: "linked-story", title: "Linked Story", thesis: "Unrelated canonical thesis.", market_question: null, assets: [], status: "archived" },
    ],
    evidenceRows: [
      { id: NOISE_EVIDENCE_ID, claim_text: "A software company announced a routine product refresh.", summary: null, affected_topics: [], affected_assets: [], evidence_class: "news_report" },
    ],
    storyEvidenceLinks: [
      { story_id: "story-linked", evidence_id: NOISE_EVIDENCE_ID },
    ],
  });

  assert.equal(agenda.length, 1);
  assert.equal(agenda[0]?.story_id, "story-linked");
  assert.equal(agenda[0]?.match_basis, "existing_story_evidence");
});

test("Dossier can pair an untagged credible news item with an archived Story when both match the current regime", () => {
  const inputPacket = packet();
  const analyticalOutput = output(inputPacket);
  const agenda = buildDossierStoryRefreshAgenda({
    dossierId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    dossier: dossierRecord("dddddddd-dddd-4ddd-8ddd-dddddddddddd", inputPacket, analyticalOutput),
    packet: inputPacket,
    analyticalOutput,
    stories: [
      {
        id: "story-diesel",
        slug: "refining-crack-spread-stress",
        title: "Diesel remains tight as refining cracks stay elevated",
        thesis: "Distillate supply tightness and refinery constraints can keep diesel prices elevated.",
        market_question: "Can tight diesel supply sustain fuel-cost pressure?",
        assets: ["ULSD", "DIESEL_CRACK"],
        status: "archived",
      },
    ],
    evidenceRows: [
      {
        id: OIL_EVIDENCE_ID,
        claim_text: "Refinery attacks and tight diesel supply are keeping distillate markets under pressure.",
        summary: null,
        affected_topics: [],
        affected_assets: ["ULSD"],
        evidence_class: "news_report",
      },
    ],
    storyEvidenceLinks: [],
  });

  assert.equal(agenda.length, 1);
  assert.equal(agenda[0]?.story_id, "story-diesel");
  assert.equal(agenda[0]?.match_basis, "dossier_story_match");
});

test("B4 ACCEPT wakes the exact Story from the Dossier Motion snapshot without lexical matching", () => {
  const inputPacket = packet();
  const externalEvidenceId = "verified-macro:rates-b4";
  inputPacket.observed_evidence[0]!.evidence_id = externalEvidenceId;
  const analyticalOutput = output(inputPacket);
  const motionId = "motion:b4:rates";
  const storyId = "44444444-4444-4444-8444-444444444444";
  analyticalOutput.motion_attention_assessments = [{
    motion_id: motionId,
    decision: "ACCEPT",
    reason: "Canonical evidence supports an exact Story-level reassessment.",
    evidence_references: [externalEvidenceId],
    story_implication: "Reassess the exact rates Story for persistent long-end pressure.",
    regime_implication: "Rates remain restrictive.",
    investigation_next: null,
    refined_headline: null,
    refined_why_interesting: null,
    refined_big_picture_bridge: null,
  }];
  const dossier = dossierRecord(
    "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    inputPacket,
    analyticalOutput,
    [{
      motion_id: motionId,
      primary_story_id: storyId,
      primary_regime_slug: "global-cost-of-capital",
      packet_evidence_id: externalEvidenceId,
    }],
  );

  const agenda = buildDossierStoryRefreshAgenda({
    dossierId: dossier.id,
    dossier,
    packet: inputPacket,
    analyticalOutput,
    stories: [{
      id: storyId,
      slug: "rates-long-end-pressure",
      title: "Unrelated display wording",
      thesis: "A canonical rates thesis.",
      market_question: null,
      assets: [],
      status: "developing",
    }],
    evidenceRows: [{
      id: FED_EVIDENCE_ID,
      external_evidence_id: externalEvidenceId,
      claim_text: "Evidence wording intentionally has no lexical overlap with the Story.",
      summary: null,
      affected_topics: [],
      affected_assets: [],
      evidence_class: "official_release",
    }],
    storyEvidenceLinks: [],
  });

  assert.equal(agenda.length, 1);
  assert.equal(agenda[0]?.story_id, storyId);
  assert.equal(agenda[0]?.evidence_id, FED_EVIDENCE_ID);
  assert.equal(agenda[0]?.match_basis, "dossier_motion_story");
  assert.equal(agenda[0]?.priority, 95);
  assert.match(agenda[0]?.reason || "", new RegExp(motionId));
});

test("B4 REFINE wakes the same exact Story using corrected Dossier reasoning", () => {
  const inputPacket = packet();
  const analyticalOutput = output(inputPacket);
  const motionId = "motion:b4:refine";
  const storyId = "55555555-5555-4555-8555-555555555555";
  analyticalOutput.motion_attention_assessments = [{
    motion_id: motionId,
    decision: "REFINE",
    reason: "The development is supported but the original framing was too broad.",
    evidence_references: [FED_EVIDENCE_ID],
    story_implication: "The exact Story should be re-evaluated using the narrower framing.",
    regime_implication: null,
    investigation_next: "Test the narrower channel.",
    refined_headline: "Narrower evidence-bounded rates development",
    refined_why_interesting: "The event matters without proving the original broad cause.",
    refined_big_picture_bridge: "Observed move -> narrower rates channel -> Story reassessment.",
  }];
  const dossier = dossierRecord(
    "ffffffff-ffff-4fff-8fff-ffffffffffff",
    inputPacket,
    analyticalOutput,
    [{
      motion_id: motionId,
      primary_story_id: storyId,
      primary_regime_slug: "global-cost-of-capital",
      packet_evidence_id: FED_EVIDENCE_ID,
    }],
  );

  const agenda = buildDossierStoryRefreshAgenda({
    dossierId: dossier.id,
    dossier,
    packet: inputPacket,
    analyticalOutput,
    stories: [{
      id: storyId,
      slug: "exact-refined-story",
      title: "Exact refined Story",
      thesis: "Existing thesis.",
      market_question: null,
      assets: [],
      status: "developing",
    }],
    evidenceRows: [{
      id: FED_EVIDENCE_ID,
      claim_text: "Canonical evidence.",
      summary: null,
      affected_topics: [],
      affected_assets: [],
      evidence_class: "official_release",
    }],
    storyEvidenceLinks: [],
  });

  assert.equal(agenda[0]?.story_id, storyId);
  assert.equal(agenda[0]?.match_basis, "dossier_motion_story");
  assert.match(agenda[0]?.reason || "", /:refine$/);
});

test("B4 regime-only ACCEPT does not manufacture a Story refresh target", () => {
  const inputPacket = packet();
  const analyticalOutput = output(inputPacket);
  const motionId = "motion:b4:regime-only";
  analyticalOutput.motion_attention_assessments = [{
    motion_id: motionId,
    decision: "ACCEPT",
    reason: "Evidence supports Regime context only.",
    evidence_references: [FED_EVIDENCE_ID],
    story_implication: null,
    regime_implication: "The rate regime remains restrictive.",
    investigation_next: null,
    refined_headline: null,
    refined_why_interesting: null,
    refined_big_picture_bridge: null,
  }];
  const dossier = dossierRecord(
    "99999999-9999-4999-8999-999999999999",
    inputPacket,
    analyticalOutput,
    [{
      motion_id: motionId,
      primary_story_id: null,
      primary_regime_slug: "global-cost-of-capital",
      packet_evidence_id: FED_EVIDENCE_ID,
    }],
  );

  const agenda = buildDossierStoryRefreshAgenda({
    dossierId: dossier.id,
    dossier,
    packet: inputPacket,
    analyticalOutput,
    stories: [{
      id: "66666666-6666-4666-8666-666666666666",
      slug: "should-not-be-invented",
      title: "Should not be invented",
      thesis: "No exact Motion Story identity.",
      market_question: null,
      assets: [],
      status: "developing",
    }],
    evidenceRows: [{
      id: FED_EVIDENCE_ID,
      claim_text: "Generic evidence with no relevant lexical match.",
      summary: null,
      affected_topics: [],
      affected_assets: [],
      evidence_class: "official_release",
    }],
    storyEvidenceLinks: [],
  });

  assert.equal(agenda.some((item) => item.match_basis === "dossier_motion_story"), false);
});

test("Dossier Story refresh agenda is bounded to the existing Story-review budget", () => {
  const inputPacket = packet();
  const analyticalOutput = output(inputPacket);
  analyticalOutput.main_thread.evidence_references = [FED_EVIDENCE_ID];

  const stories = Array.from({ length: 8 }, (_, index) => ({
    id: `story-${index}`,
    slug: `fed-story-${index}`,
    title: `Fed Story ${index}`,
    thesis: "Federal Reserve rate policy and Treasury yield repricing.",
    market_question: null,
    assets: ["US02Y"],
    status: "archived",
  }));
  const agenda = buildDossierStoryRefreshAgenda({
    dossierId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    dossier: dossierRecord("cccccccc-cccc-4ccc-8ccc-cccccccccccc", inputPacket, analyticalOutput),
    packet: inputPacket,
    analyticalOutput,
    stories,
    evidenceRows: [
      { id: FED_EVIDENCE_ID, claim_text: "The Federal Reserve delivered a hawkish rate hike while front-end Treasury yields repriced higher.", summary: null, affected_topics: stories.map((story) => story.slug), affected_assets: ["US02Y"], evidence_class: "news_report" },
    ],
    storyEvidenceLinks: [],
  });

  assert.equal(agenda.length, MAX_DOSSIER_STORY_REFRESH_TARGETS);
});

test("reinforced archived Story revival is explicit in the production migration", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/20260922060000_dossier_story_refresh_revival.sql", import.meta.url),
    "utf8",
  );

  assert.match(
    migration,
    /story_row\.status='archived' and effective_status='reinforced' then 'publish'/,
  );
  assert.match(
    migration,
    /when material_allowed and story_changed then public_status not in \('archived','discarded'\)/,
  );
});
