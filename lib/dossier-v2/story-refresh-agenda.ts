import type { SupabaseClient } from "@supabase/supabase-js";

import type { MarketDossierV2 } from "./contracts.ts";
import type { DossierV2InputPacket } from "./input-packet.ts";
import type { ResearchBrainOutputV1 } from "./research-brain-contracts.ts";
import { isValidUuid } from "./validation.ts";

export const MAX_DOSSIER_STORY_REFRESH_TARGETS = 4;

type StoryRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
};

type EvidenceRow = {
  id: string;
  claim_text: string;
  summary: string | null;
  affected_topics: string[] | null;
  affected_assets: string[] | null;
  evidence_class: string;
  received_at?: string | null;
  event_at?: string | null;
};

type StoryEvidenceLinkRow = {
  story_id: string;
  evidence_id: string;
};

export type DossierStoryRefreshAgendaItem = {
  story_id: string;
  story_slug: string;
  story_status: string;
  evidence_id: string;
  score: number;
  priority: number;
  match_basis: "existing_story_evidence" | "affected_story_slug";
  reason: string;
};

export type DossierStoryRefreshAgendaResult = {
  dossier_id: string;
  status: "queued" | "empty" | "failed";
  candidates: number;
  enqueued: number;
  skipped_existing: number;
  items: DossierStoryRefreshAgendaItem[];
  error?: string;
};

const STOP_WORDS = new Set([
  "about", "after", "again", "against", "also", "among", "and", "are", "because",
  "been", "before", "being", "between", "but", "can", "could", "current", "does",
  "from", "have", "into", "just", "market", "markets", "more", "most", "not",
  "now", "only", "other", "over", "same", "should", "that", "the", "their",
  "there", "these", "they", "this", "through", "under", "very", "what", "when",
  "where", "which", "while", "with", "would",
]);

function unique(values: string[]) {
  return [...new Set(values)];
}

function words(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

function attentionText(output: ResearchBrainOutputV1) {
  return [
    output.main_thread.headline,
    output.main_thread.answer,
    output.main_thread.regime_implication,
    output.market_verdict.cross_asset_readthrough,
    output.market_verdict.dominant_confirmation,
    output.market_verdict.dominant_contradiction,
    ...output.major_stories.flatMap((story) => [
      story.title,
      story.what_changed,
      story.why_it_matters,
      story.causal_mechanism,
      story.conclusion,
    ]),
    ...output.investigations.flatMap((investigation) => [
      investigation.question,
      investigation.why_it_matters,
      investigation.current_explanation,
      investigation.research_next,
    ]),
    ...output.developing_themes.flatMap((theme) => [theme.title, theme.summary]),
    ...output.stock_radar.flatMap((item) => [
      item.symbol,
      item.company_name,
      item.why_relevant,
      item.research_question,
    ]),
  ].filter(Boolean).join("\n");
}

function explicitEvidenceReferences(output: ResearchBrainOutputV1) {
  return new Set(unique([
    ...output.main_thread.evidence_references,
    ...output.main_thread.contradiction_references,
    ...output.major_stories.flatMap((story) => [
      ...story.evidence_ids,
      ...story.market_evidence.confirming,
      ...story.market_evidence.contradicting,
      ...story.market_evidence.unresolved,
    ]),
    ...output.investigations.flatMap((investigation) => investigation.observed_evidence),
    ...Object.values(output.market_verdict.lenses).flatMap((lens) => [
      ...lens.observed_reaction_evidence_refs,
      ...lens.contradiction_references,
    ]),
    ...output.developing_themes.flatMap((theme) => theme.supporting_evidence_ids),
    ...output.stock_radar.flatMap((item) => item.evidence_references),
    ...output.thesis_ledger.entries.flatMap((entry) => entry.current_evidence_refs),
    ...output.contradictions_detected.flatMap((item) => item.conflicting_evidence_ids),
  ].filter((id) => isValidUuid(id))));
}

function evidenceAttentionScore(
  evidence: EvidenceRow,
  explicitRefs: Set<string>,
  attentionTerms: Set<string>,
) {
  if (explicitRefs.has(evidence.id)) return 100;
  const evidenceTerms = new Set(words(`${evidence.claim_text} ${evidence.summary ?? ""} ${evidence.evidence_class}`));
  let overlap = 0;
  for (const term of evidenceTerms) {
    if (attentionTerms.has(term)) overlap += 1;
  }
  if (overlap < 2) return 0;
  return Math.min(85, 50 + overlap * 7);
}

export function buildDossierStoryRefreshAgenda(input: {
  dossierId: string;
  packet: DossierV2InputPacket;
  analyticalOutput: ResearchBrainOutputV1;
  stories: StoryRow[];
  evidenceRows: EvidenceRow[];
  storyEvidenceLinks: StoryEvidenceLinkRow[];
}): DossierStoryRefreshAgendaItem[] {
  const explicitRefs = explicitEvidenceReferences(input.analyticalOutput);
  const attentionTerms = new Set(words(attentionText(input.analyticalOutput)));
  const evidenceById = new Map(
    input.evidenceRows
      .filter((row) => isValidUuid(row.id))
      .map((row) => [row.id, row]),
  );
  const storyById = new Map(input.stories.map((story) => [story.id, story]));
  const storyBySlug = new Map(input.stories.map((story) => [story.slug, story]));
  const linkedStoriesByEvidence = new Map<string, Set<string>>();

  for (const link of input.storyEvidenceLinks) {
    if (!storyById.has(link.story_id) || !evidenceById.has(link.evidence_id)) continue;
    const ids = linkedStoriesByEvidence.get(link.evidence_id) ?? new Set<string>();
    ids.add(link.story_id);
    linkedStoriesByEvidence.set(link.evidence_id, ids);
  }

  const bestByStory = new Map<string, DossierStoryRefreshAgendaItem>();

  for (const [evidenceId, evidenceRow] of evidenceById) {
    const attentionScore = evidenceAttentionScore(evidenceRow, explicitRefs, attentionTerms);
    if (attentionScore === 0) continue;

    const mapped = new Map<string, DossierStoryRefreshAgendaItem["match_basis"]>();
    for (const storyId of linkedStoriesByEvidence.get(evidenceId) ?? []) {
      mapped.set(storyId, "existing_story_evidence");
    }
    for (const slug of evidenceRow.affected_topics ?? []) {
      const story = storyBySlug.get(slug);
      if (story && !mapped.has(story.id)) mapped.set(story.id, "affected_story_slug");
    }

    for (const [storyId, matchBasis] of mapped) {
      const story = storyById.get(storyId);
      if (!story || story.status === "discarded") continue;
      const mappingBonus = matchBasis === "existing_story_evidence" ? 20 : 15;
      const archiveBonus = story.status === "archived" ? 5 : 0;
      const score = Math.min(125, attentionScore + mappingBonus + archiveBonus);
      const priority = Math.max(70, Math.min(95, Math.round(60 + score / 3)));
      const candidate: DossierStoryRefreshAgendaItem = {
        story_id: story.id,
        story_slug: story.slug,
        story_status: story.status,
        evidence_id: evidenceId,
        score,
        priority,
        match_basis: matchBasis,
        reason: `dossier_refresh:${input.dossierId}:${matchBasis}`,
      };
      const current = bestByStory.get(story.id);
      if (!current || candidate.score > current.score
        || (candidate.score === current.score && candidate.evidence_id < current.evidence_id)) {
        bestByStory.set(story.id, candidate);
      }
    }
  }

  return [...bestByStory.values()]
    .sort((left, right) => right.score - left.score
      || right.priority - left.priority
      || left.story_id.localeCompare(right.story_id))
    .slice(0, MAX_DOSSIER_STORY_REFRESH_TARGETS);
}

export async function enqueueDossierStoryRefreshAgenda(input: {
  client: SupabaseClient;
  dossier: MarketDossierV2;
  packet: DossierV2InputPacket;
  analyticalOutput: ResearchBrainOutputV1;
}): Promise<DossierStoryRefreshAgendaResult> {
  try {
    const asOfMs = Date.parse(input.packet.as_of);
    if (!Number.isFinite(asOfMs)) {
      throw new Error("Dossier Story refresh agenda received an invalid packet as_of.");
    }
    const since = new Date(asOfMs - 168 * 60 * 60 * 1_000).toISOString();

    const [{ data: stories, error: storyError }, { data: evidenceRows, error: evidenceError }] = await Promise.all([
      input.client
        .from("stories")
        .select("id,slug,title,status")
        .neq("status", "discarded"),
      input.client
        .from("intelligence_evidence")
        .select("id,claim_text,summary,affected_topics,affected_assets,evidence_class,received_at,event_at")
        .gte("received_at", since)
        .lte("received_at", input.packet.as_of)
        .in("freshness_status", ["current", "aging"])
        .order("received_at", { ascending: false })
        .limit(180),
    ]);

    if (storyError) throw new Error(`Failed to load Story registry: ${storyError.message}`);
    if (evidenceError) throw new Error(`Failed to load bounded canonical Story-refresh evidence: ${evidenceError.message}`);

    const boundedEvidenceRows = (evidenceRows ?? []) as EvidenceRow[];
    const evidenceIds = unique(boundedEvidenceRows.map((row) => row.id).filter((id) => isValidUuid(id)));
    if (!evidenceIds.length) {
      return {
        dossier_id: input.dossier.id,
        status: "empty",
        candidates: 0,
        enqueued: 0,
        skipped_existing: 0,
        items: [],
      };
    }

    const { data: links, error: linkError } = await input.client
      .from("intelligence_story_evidence")
      .select("story_id,evidence_id")
      .in("evidence_id", evidenceIds);

    if (linkError) throw new Error(`Failed to load Story evidence links: ${linkError.message}`);

    const items = buildDossierStoryRefreshAgenda({
      dossierId: input.dossier.id,
      packet: input.packet,
      analyticalOutput: input.analyticalOutput,
      stories: (stories ?? []) as StoryRow[],
      evidenceRows: boundedEvidenceRows,
      storyEvidenceLinks: (links ?? []) as StoryEvidenceLinkRow[],
    });

    if (!items.length) {
      return {
        dossier_id: input.dossier.id,
        status: "empty",
        candidates: 0,
        enqueued: 0,
        skipped_existing: 0,
        items: [],
      };
    }

    const storyIds = unique(items.map((item) => item.story_id));
    const requestedEvidenceIds = unique(items.map((item) => item.evidence_id));
    const { data: existingRows, error: existingError } = await input.client
      .from("intelligence_reevaluation_queue")
      .select("target_id,requested_by_evidence_id,status")
      .eq("target_kind", "story")
      .in("target_id", storyIds)
      .in("requested_by_evidence_id", requestedEvidenceIds)
      .in("status", ["pending", "processing", "retryable"]);

    if (existingError) {
      throw new Error(`Failed to inspect existing Story refresh queue: ${existingError.message}`);
    }

    const existing = new Set((existingRows ?? []).map((row) =>
      `${String(row.target_id)}:${String(row.requested_by_evidence_id)}`));
    const missing = items.filter((item) => !existing.has(`${item.story_id}:${item.evidence_id}`));

    if (missing.length) {
      const { error: insertError } = await input.client
        .from("intelligence_reevaluation_queue")
        .insert(missing.map((item) => ({
          target_kind: "story",
          target_id: item.story_id,
          requested_by_evidence_id: item.evidence_id,
          reason: item.reason,
          priority: item.priority,
          status: "pending",
          available_at: input.packet.as_of,
        })));
      if (insertError) throw new Error(`Failed to enqueue Dossier Story refresh agenda: ${insertError.message}`);
    }

    console.info(JSON.stringify({
      event: "dossier_story_refresh_agenda",
      dossierId: input.dossier.id,
      candidateCount: items.length,
      enqueuedCount: missing.length,
      skippedExistingCount: items.length - missing.length,
      items,
    }));

    return {
      dossier_id: input.dossier.id,
      status: "queued",
      candidates: items.length,
      enqueued: missing.length,
      skipped_existing: items.length - missing.length,
      items,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(JSON.stringify({
      event: "dossier_story_refresh_agenda_failed",
      dossierId: input.dossier.id,
      error: message.slice(0, 500),
    }));
    return {
      dossier_id: input.dossier.id,
      status: "failed",
      candidates: 0,
      enqueued: 0,
      skipped_existing: 0,
      items: [],
      error: message,
    };
  }
}
