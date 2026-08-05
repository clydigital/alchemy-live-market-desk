import { unstable_cache } from "next/cache";

import type {
  ClaimCheckInput,
  ExpertNoteInput,
  JargonResearchInput,
  ResearchScheduleSlot,
} from "@/lib/research-update";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REVALIDATE_SECONDS = 60;

async function privateQuery<T>(table: string, params = ""): Promise<T[]> {
  if (!url || !serviceKey) return [];
  const response = await fetch(`${url}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!response.ok) return [];
  return response.json();
}

export type ResearchRunLedger = {
  id: string;
  run_key: string;
  schedule_slot: ResearchScheduleSlot;
  scheduled_for: string;
  started_at: string;
  completed_at: string | null;
  status: "running" | "completed" | "blocked" | "failed";
  accuracy_gate: "open" | "review" | "blocked";
  required_sources_complete: boolean;
  evidence_gate_passed: boolean;
  freshness_gate_passed: boolean;
  source_checks: Array<{ source: string; status: string; itemCount?: number; note?: string }>;
  process_log: Array<{ stage: string; status: string; note: string; at: string }>;
  calendar_checks: Array<{ calendar: string; status: string; catalystsFound?: number; note?: string }>;
  videos_found: number;
  transcripts_ready: number;
  news_scanned: number;
  candidates_kept: number;
  articles_scanned: number;
  articles_flagged: number;
  evidence_added: number;
  jargon_terms_researched: number;
  expert_notes_added: number;
  stories_demoted: number;
  focus_decisions_count: number;
  updates_published: number;
  focus_changes_published: number;
  warnings: string[];
  summary: string | null;
  updated_at: string;
};

export type ResearchIntakeLedgerItem = {
  id: string;
  run_id: string;
  item_key: string;
  item_type: "video" | "news" | "alchemy_article";
  publisher: string;
  title: string;
  url: string;
  published_at: string;
  article_position: number | null;
  transcript_status: "ready" | "missing" | "unavailable" | "not_applicable" | null;
  transcript_provider: "youtubetotranscript.com" | "official" | "other" | null;
  video_review_status: "reviewed" | "listened" | "transcript_only" | "unavailable" | null;
  transcript_word_count: number;
  summary: string;
  creator_logic: string | null;
  recontextualized_summary: string | null;
  terms_detected: string[];
  jargon_research: JargonResearchInput[];
  claim_checks: ClaimCheckInput[];
  expert_notes: ExpertNoteInput[];
  affected_story_slugs: string[];
  source_quality: number;
  relevance: number;
  novelty: number;
  materiality: number;
  freshness_score: number;
  candidate_score: number;
  recommended_action: "ignore" | "monitor" | "collect_evidence" | "review_article" | "recalibrate_story";
  status: "candidate" | "accepted" | "blocked" | "published" | "rejected";
  stats_signal: string | null;
  news_signal: string | null;
  divergence_kind: "none" | "stats_lead" | "news_lead" | "contradiction";
  divergence_note: string | null;
  evidence_links: Array<{ title: string; url: string; publishedAt: string; publisher?: string; evidenceClass?: string }>;
  review_reason: string | null;
  updated_at: string;
};

export type ResearchStoryFocus = {
  id: string;
  run_id: string;
  story_slug: string;
  headline: string;
  angle_key: string;
  priority: number;
  proposed_decision: "lead" | "top_three" | "background" | "rejected";
  decision: "lead" | "top_three" | "background" | "rejected";
  event_at: string | null;
  next_catalyst_at: string | null;
  material_change: boolean;
  material_change_reason: string | null;
  freshness_status: "fresh_72h" | "upcoming_7d" | "materially_refreshed" | "stale";
  freshness_reason: string;
  demotion_reason: string | null;
  evidence_item_keys: string[];
  expert_notes: ExpertNoteInput[];
  created_at: string;
  updated_at: string;
};

async function loadResearchLedger() {
  const [runs, intake, focus] = await Promise.all([
    privateQuery<ResearchRunLedger>("research_run_status", "select=*&order=scheduled_for.desc&limit=24"),
    privateQuery<ResearchIntakeLedgerItem>("research_intake_queue", "select=*&order=published_at.desc,candidate_score.desc&limit=160"),
    privateQuery<ResearchStoryFocus>("research_story_focus", "select=*&order=created_at.desc,priority.asc&limit=160"),
  ]);
  return { runs, intake, focus };
}

export const getResearchLedger = unstable_cache(
  loadResearchLedger,
  ["alchemy-research-ledger-v2"],
  { revalidate: REVALIDATE_SECONDS },
);
