import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

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
  const agenda = buildDossierStoryRefreshAgenda({
    dossierId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    packet: inputPacket,
    analyticalOutput: output(inputPacket),
    stories: [
      { id: "story-fed", slug: "fed-rate-repricing", title: "Fed rate repricing", status: "archived" },
      { id: "story-oil", slug: "refining-crack-spread-stress", title: "Refining crack spread stress", status: "archived" },
      { id: "story-noise", slug: "software-refresh", title: "Software refresh", status: "archived" },
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
    packet: inputPacket,
    analyticalOutput,
    stories: [
      { id: "story-linked", slug: "linked-story", title: "Linked Story", status: "archived" },
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

test("Dossier Story refresh agenda is bounded to the existing Story-review budget", () => {
  const inputPacket = packet();
  const analyticalOutput = output(inputPacket);
  analyticalOutput.main_thread.evidence_references = [FED_EVIDENCE_ID];

  const stories = Array.from({ length: 8 }, (_, index) => ({
    id: `story-${index}`,
    slug: `fed-story-${index}`,
    title: `Fed Story ${index}`,
    status: "archived",
  }));
  const agenda = buildDossierStoryRefreshAgenda({
    dossierId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
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
