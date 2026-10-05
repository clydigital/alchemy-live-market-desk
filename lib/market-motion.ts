import type { SupabaseClient } from "@supabase/supabase-js";

import type { Story } from "./data.ts";
import { routeTextToRegimes, type RegimeSlug } from "./regimes.ts";
import { createSupabaseAdminClient } from "./supabase/admin.ts";

export const MARKET_MOTION_CONTRACT_VERSION = "market-motion/v1" as const;
export const MARKET_MOTION_FRESHNESS_HOURS = 48;
// Safety ceiling only. Editorial importance is decided upstream; the overview is not a three-hook quota.
export const MARKET_MOTION_DISPLAY_SAFETY_LIMIT = 18;

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


export type MarketMotionRoutingClass =
  | "STORY"
  | "REGIME"
  | "INVESTIGATION_CANDIDATE";

const GENERIC_MARKET_MOTION_NEXT_TESTS = new Set([
  "check whether the linked assets and broader story / regime reaction confirm the information.",
  "seek independent or primary-source confirmation, then test whether the market reaction persists.",
]);

function normalizedMotionRoutingText(value: string | null | undefined) {
  return value?.trim() || "";
}

export function isConcreteMarketMotionNextTest(
  value: string | null | undefined,
): boolean {
  const clean = normalizedMotionRoutingText(value);
  return Boolean(clean) && !GENERIC_MARKET_MOTION_NEXT_TESTS.has(clean.toLowerCase());
}

export function deriveMarketMotionRoutingClass(input: {
  primaryStoryId?: string | null;
  primaryRegimeSlug?: string | null;
  nextTest?: string | null;
}): MarketMotionRoutingClass | null {
  if (normalizedMotionRoutingText(input.primaryStoryId)) return "STORY";
  if (normalizedMotionRoutingText(input.primaryRegimeSlug)) return "REGIME";
  if (isConcreteMarketMotionNextTest(input.nextTest)) return "INVESTIGATION_CANDIDATE";
  return null;
}

export type MarketMotionAttentionTier = "PRIMARY" | "SECONDARY";
export type MarketMotionWritingPotential = "HIGH" | "MEDIUM" | "LOW";

export type MarketMotionAttention = {
  tier: MarketMotionAttentionTier;
  score: number;
  writingPotential: MarketMotionWritingPotential;
  reasons: string[];
};

export type MarketMotionInvestigationEligibility = {
  eligible: boolean;
  reason:
    | "ELIGIBLE"
    | "NO_NEXT_TEST"
    | "NO_STORY_LINK"
    | "NOT_PROMOTED"
    | "EXPIRED"
    | "INVALID_EXPIRY"
    | "CONTRADICTED";
  nextTest: string | null;
  storyId: string | null;
};

export function marketMotionInvestigationEligibility(
  input: {
    lifecycleState: MarketMotionLifecycleState;
    verificationState: MarketMotionVerificationState;
    expiresAt: string;
    nextTest?: string | null;
    storyId?: string | null;
  },
  now = new Date(),
): MarketMotionInvestigationEligibility {
  const nextTest = input.nextTest?.trim() || null;
  const storyId = input.storyId?.trim() || null;
  if (!nextTest) return { eligible: false, reason: "NO_NEXT_TEST", nextTest: null, storyId };
  if (!storyId) return { eligible: false, reason: "NO_STORY_LINK", nextTest, storyId: null };
  if (input.lifecycleState !== "PROMOTED") {
    return { eligible: false, reason: "NOT_PROMOTED", nextTest, storyId };
  }
  const expiry = Date.parse(input.expiresAt);
  if (!Number.isFinite(expiry)) {
    return { eligible: false, reason: "INVALID_EXPIRY", nextTest, storyId };
  }
  if (expiry <= now.getTime()) {
    return { eligible: false, reason: "EXPIRED", nextTest, storyId };
  }
  if (input.verificationState === "CONTRADICTED") {
    return { eligible: false, reason: "CONTRADICTED", nextTest, storyId };
  }
  return { eligible: true, reason: "ELIGIBLE", nextTest, storyId };
}

type MarketMotionAttentionInput = {
  materiality: number;
  relevance: number;
  novelty: number;
  verificationState: MarketMotionVerificationState;
  lifecycleState: MarketMotionLifecycleState;
  category: MarketMotionCategory;
  tickers?: string[];
  marketReaction?: string | null;
  metadata?: Record<string, unknown> | null;
};

function metadataArrayCount(metadata: Record<string, unknown> | null | undefined, field: string) {
  return Array.isArray(metadata?.[field]) ? (metadata![field] as unknown[]).length : 0;
}

export function deriveMarketMotionAttention(input: MarketMotionAttentionInput): MarketMotionAttention {
  const verificationBonus =
    input.verificationState === "VERIFIED" ? 7
      : input.verificationState === "REPORTED" ? 4
        : input.verificationState === "PARTIAL" ? 2
          : input.verificationState === "UNRESOLVED" ? -2
            : input.verificationState === "CONTRADICTED" ? -8
              : 0;
  const sourceRefCount = metadataArrayCount(input.metadata, "sourceRefs");
  const writingAngleCount = metadataArrayCount(input.metadata, "writingAngles");
  const researchQuestionCount = metadataArrayCount(input.metadata, "researchQuestions");
  const corroborationBonus = sourceRefCount >= 2 ? 3 : 0;
  const writingBonus = writingAngleCount > 0 ? 4 : 0;
  const researchBonus = researchQuestionCount > 0 ? 2 : 0;
  const tickerBonus = input.tickers?.length ? 2 : 0;
  const reactionBonus = input.marketReaction ? 2 : 0;
  const promotionBonus = input.lifecycleState === "PROMOTED" ? 3 : 0;

  const score = Math.max(0, Math.min(100, Math.round(
    input.materiality * 0.45
    + input.relevance * 0.35
    + input.novelty * 0.10
    + verificationBonus
    + corroborationBonus
    + writingBonus
    + researchBonus
    + tickerBonus
    + reactionBonus
    + promotionBonus,
  )));

  const tier: MarketMotionAttentionTier =
    score >= 82 && input.materiality >= 78 && input.relevance >= 74
      ? "PRIMARY"
      : "SECONDARY";

  const companyLike = input.category === "COMPANY" || input.category === "EARNINGS";
  const writingPotential: MarketMotionWritingPotential =
    writingAngleCount > 0 || (companyLike && Boolean(input.tickers?.length) && score >= 78)
      ? "HIGH"
      : researchQuestionCount > 0 || Boolean(input.tickers?.length) || input.category === "MARKET_STRUCTURE"
        ? "MEDIUM"
        : "LOW";

  const reasons: string[] = [];
  if (input.materiality >= 85) reasons.push("high materiality");
  if (input.relevance >= 85) reasons.push("high market relevance");
  if (input.verificationState === "VERIFIED") reasons.push("primary/official verification");
  else if (sourceRefCount >= 2) reasons.push("multi-source corroboration");
  if (input.marketReaction) reasons.push("market reaction captured");
  if (writingAngleCount > 0) reasons.push("explicit writing angle");
  else if (researchQuestionCount > 0) reasons.push("specific research question");
  if (input.tickers?.length) reasons.push("asset/ticker linked");

  return {
    tier,
    score,
    writingPotential,
    reasons: reasons.slice(0, 4),
  };
}

export function marketMotionAttention(item: MarketMotionRecord): MarketMotionAttention {
  return deriveMarketMotionAttention({
    materiality: item.materiality,
    relevance: item.relevance,
    novelty: item.novelty,
    verificationState: item.verification_state,
    lifecycleState: item.lifecycle_state,
    category: item.category,
    tickers: item.tickers,
    marketReaction: item.market_reaction,
    metadata: item.metadata,
  });
}

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
  limit = MARKET_MOTION_DISPLAY_SAFETY_LIMIT,
) {
  return items
    .filter((item) => marketMotionEffectiveState(item, now) !== "EXPIRED")
    .sort((left, right) => {
      const leftAttention = marketMotionAttention(left);
      const rightAttention = marketMotionAttention(right);
      const tierDelta = (rightAttention.tier === "PRIMARY" ? 1 : 0) - (leftAttention.tier === "PRIMARY" ? 1 : 0);
      if (tierDelta) return tierDelta;
      const attentionDelta = rightAttention.score - leftAttention.score;
      if (attentionDelta) return attentionDelta;
      const materialityDelta = right.materiality - left.materiality;
      if (materialityDelta) return materialityDelta;
      const relevanceDelta = right.relevance - left.relevance;
      if (relevanceDelta) return relevanceDelta;
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
