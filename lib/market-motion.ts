import type { SupabaseClient } from "@supabase/supabase-js";

import type { Story } from "./data.ts";
import { routeTextToRegimes, type RegimeSlug } from "./regimes.ts";
import { createSupabaseAdminClient } from "./supabase/admin.ts";

export const MARKET_MOTION_CONTRACT_VERSION = "market-motion/v1" as const;
export const MARKET_MOTION_FRESHNESS_HOURS = 72;
export const MARKET_MOTION_OVERVIEW_LIMIT = 3;

export const MARKET_MOTION_STATES = ["MOTION", "PROMOTED", "EXPIRED"] as const;
export type MarketMotionLifecycleState = typeof MARKET_MOTION_STATES[number];

export const MARKET_MOTION_VERIFICATION_STATES = [
  "LEAD",
  "REPORTED",
  "VERIFIED",
  "PARTIAL",
  "CONTRADICTED",
  "UNRESOLVED",
] as const;
export type MarketMotionVerificationState = typeof MARKET_MOTION_VERIFICATION_STATES[number];

export const MARKET_MOTION_CATEGORIES = [
  "COMPANY",
  "EARNINGS",
  "GEOPOLITICS",
  "MACRO",
  "POLICY",
  "ENERGY",
  "COMMODITY",
  "MARKET_STRUCTURE",
  "SECTOR",
  "OTHER",
] as const;
export type MarketMotionCategory = typeof MARKET_MOTION_CATEGORIES[number];

export type MarketMotionInput = {
  motionKey: string;
  lifecycleState?: Exclude<MarketMotionLifecycleState, "EXPIRED"> | "EXPIRED";
  category: MarketMotionCategory;
  verificationState?: MarketMotionVerificationState;
  headline: string;
  whatHappened: string;
  marketReaction?: string | null;
  whyInteresting: string;
  bigPictureBridge: string;
  nextTest?: string | null;
  promotionReason?: string | null;
  tickers?: string[];
  sourceName: string;
  sourceUrl: string;
  sourceKind?: "primary" | "official" | "filing" | "reporting" | "market_data" | "creator" | "other";
  materiality?: number;
  relevance?: number;
  novelty?: number;
  occurredAt: string;
  observedAt?: string;
  expiresAt?: string | null;
  researchRunId?: string | null;
  sourceId?: string | null;
  evidenceId?: string | null;
  primaryStoryId?: string | null;
  primaryRegimeSlug?: RegimeSlug | null;
  metadata?: Record<string, unknown>;
};

export type MarketMotionRecord = {
  id: string;
  motion_key: string;
  version_number: number;
  previous_version_id: string | null;
  contract_version: typeof MARKET_MOTION_CONTRACT_VERSION | string;
  research_run_id: string | null;
  source_id: string | null;
  evidence_id: string | null;
  primary_story_id: string | null;
  primary_regime_slug: RegimeSlug | null;
  lifecycle_state: MarketMotionLifecycleState;
  effective_state?: MarketMotionLifecycleState;
  category: MarketMotionCategory;
  verification_state: MarketMotionVerificationState;
  headline: string;
  what_happened: string;
  market_reaction: string | null;
  why_interesting: string;
  big_picture_bridge: string;
  next_test: string | null;
  promotion_reason: string | null;
  tickers: string[];
  source_name: string;
  source_url: string;
  source_kind: string;
  materiality: number;
  relevance: number;
  novelty: number;
  occurred_at: string;
  observed_at: string;
  expires_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

function boundedScore(value: number | undefined, fallback = 50) {
  const numeric = Number(value ?? fallback);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function requiredText(value: string, field: string, max: number) {
  const clean = value.trim();
  if (!clean) throw new Error(`Market Motion ${field} is required.`);
  if (clean.length > max) throw new Error(`Market Motion ${field} exceeds ${max} characters.`);
  return clean;
}

function safeHttpsUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Market Motion sourceUrl must be a credential-free HTTPS URL.");
  }
  return url.toString();
}

function validIso(value: string, field: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`Market Motion ${field} must be a valid timestamp.`);
  return new Date(timestamp).toISOString();
}

export function marketMotionExpiry(occurredAt: string, observedAt = occurredAt, hours = MARKET_MOTION_FRESHNESS_HOURS) {
  const occurred = Date.parse(occurredAt);
  const observed = Date.parse(observedAt);
  if (!Number.isFinite(occurred) || !Number.isFinite(observed)) {
    throw new Error("Market Motion expiry requires valid occurredAt and observedAt timestamps.");
  }
  return new Date(Math.max(occurred, observed) + hours * 60 * 60 * 1_000).toISOString();
}

export function marketMotionEffectiveState(
  item: Pick<MarketMotionRecord, "lifecycle_state" | "expires_at">,
  now = new Date(),
): MarketMotionLifecycleState {
  if (item.lifecycle_state === "EXPIRED") return "EXPIRED";
  const expiry = Date.parse(item.expires_at);
  return Number.isFinite(expiry) && expiry <= now.getTime() ? "EXPIRED" : item.lifecycle_state;
}

export function resolveMarketMotionLinks(input: {
  text: string;
  affectedStorySlugs?: string[];
  stories?: Pick<Story, "id" | "slug">[];
}) {
  const storyBySlug = new Map((input.stories || []).map((story) => [story.slug, story]));
  const exactStory = (input.affectedStorySlugs || [])
    .map((slug) => storyBySlug.get(slug))
    .find(Boolean) || null;
  const regime = routeTextToRegimes(input.text, 1)[0] || null;

  return {
    primaryStoryId: exactStory?.id || null,
    primaryRegimeSlug: regime?.regime || null,
    primaryRegimeSubgroup: regime?.subgroup || null,
  };
}

export function validateMarketMotionInput(input: MarketMotionInput) {
  const occurredAt = validIso(input.occurredAt, "occurredAt");
  const observedAt = validIso(input.observedAt || new Date().toISOString(), "observedAt");
  const expiresAt = input.expiresAt
    ? validIso(input.expiresAt, "expiresAt")
    : marketMotionExpiry(occurredAt, observedAt);

  if (Date.parse(expiresAt) < Date.parse(occurredAt)) {
    throw new Error("Market Motion expiresAt cannot be earlier than occurredAt.");
  }

  return {
    motion_key: requiredText(input.motionKey, "motionKey", 300),
    contract_version: MARKET_MOTION_CONTRACT_VERSION,
    research_run_id: input.researchRunId || null,
    source_id: input.sourceId || null,
    evidence_id: input.evidenceId || null,
    primary_story_id: input.primaryStoryId || null,
    primary_regime_slug: input.primaryRegimeSlug || null,
    lifecycle_state: input.lifecycleState || "MOTION",
    category: input.category,
    verification_state: input.verificationState || "LEAD",
    headline: requiredText(input.headline, "headline", 500),
    what_happened: requiredText(input.whatHappened, "whatHappened", 4_000),
    market_reaction: input.marketReaction?.trim() || null,
    why_interesting: requiredText(input.whyInteresting, "whyInteresting", 4_000),
    big_picture_bridge: requiredText(input.bigPictureBridge, "bigPictureBridge", 4_000),
    next_test: input.nextTest?.trim() || null,
    promotion_reason: input.promotionReason?.trim() || null,
    tickers: [...new Set((input.tickers || []).map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))].slice(0, 20),
    source_name: requiredText(input.sourceName, "sourceName", 300),
    source_url: safeHttpsUrl(input.sourceUrl),
    source_kind: input.sourceKind || "reporting",
    materiality: boundedScore(input.materiality),
    relevance: boundedScore(input.relevance),
    novelty: boundedScore(input.novelty),
    occurred_at: occurredAt,
    observed_at: observedAt,
    expires_at: expiresAt,
    metadata: input.metadata || {},
  };
}

export function selectMarketMotionForOverview(
  items: MarketMotionRecord[],
  now = new Date(),
  limit = MARKET_MOTION_OVERVIEW_LIMIT,
) {
  return items
    .filter((item) => marketMotionEffectiveState(item, now) !== "EXPIRED")
    .sort((left, right) => {
      const stateDelta = (right.lifecycle_state === "PROMOTED" ? 1 : 0) - (left.lifecycle_state === "PROMOTED" ? 1 : 0);
      if (stateDelta) return stateDelta;
      const materialityDelta = right.materiality - left.materiality;
      if (materialityDelta) return materialityDelta;
      const relevanceDelta = right.relevance - left.relevance;
      if (relevanceDelta) return relevanceDelta;
      const noveltyDelta = right.novelty - left.novelty;
      if (noveltyDelta) return noveltyDelta;
      return Date.parse(right.occurred_at) - Date.parse(left.occurred_at);
    })
    .slice(0, Math.max(0, limit));
}

export async function persistMarketMotion(
  input: MarketMotionInput,
  client?: SupabaseClient,
): Promise<MarketMotionRecord> {
  const db = client ?? createSupabaseAdminClient();
  const payload = validateMarketMotionInput(input);
  const { data, error } = await db
    .from("market_motion_items")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Market Motion persistence failed: ${error?.message || "no row returned"}`);
  }
  return data as MarketMotionRecord;
}

export async function getCurrentMarketMotion(
  options: { includeExpired?: boolean; limit?: number; client?: SupabaseClient } = {},
): Promise<MarketMotionRecord[]> {
  const db = options.client ?? createSupabaseAdminClient();
  let query = db
    .from("current_market_motion_items")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(Math.max(1, Math.min(200, options.limit ?? 50)));

  if (!options.includeExpired) query = query.neq("effective_state", "EXPIRED");

  const { data, error } = await query;
  if (error) throw new Error(`Market Motion read failed: ${error.message}`);
  return (data || []) as MarketMotionRecord[];
}
