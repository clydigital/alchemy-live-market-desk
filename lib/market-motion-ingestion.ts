import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { explicitlyMentionedInstrumentSpecs } from "./instrument-mentions.ts";
import {
  getRegimeDefinition,
  type RegimeSlug,
} from "./regimes.ts";
import { parseResearchGapHandoffContext } from "./research-gap-handoff.ts";
import type { IntakeItemInput } from "./research-update.ts";
import {
  MARKET_MOTION_FRESHNESS_HOURS,
  persistMarketMotion,
  resolveMarketMotionLinks,
  type MarketMotionCategory,
  type MarketMotionInput,
  type MarketMotionRecord,
  type MarketMotionVerificationState,
} from "./market-motion.ts";
import { createSupabaseAdminClient } from "./supabase/admin.ts";
import type { TranscriptMotionLead } from "./transcript-research-review-contract.ts";

export const MARKET_MOTION_RUN_LIMIT = 18;
export const MARKET_MOTION_MIN_SCORE = 72;
export const MARKET_MOTION_MIN_MATERIALITY = 72;
export const MARKET_MOTION_MIN_RELEVANCE = 70;
export const MARKET_MOTION_MIN_NOVELTY = 65;

export type ScoredIntakeItem = IntakeItemInput & {
  candidateScore: number;
  evidence: Array<{
    title: string;
    url: string;
    publisher: string;
    publishedAt: string;
    claim: string;
  }>;
};

type StoryRef = {
  id: string;
  slug: string;
  title: string;
};

export type ReviewedTranscriptMotionRow = {
  id: string;
  run_id: string;
  item_key: string;
  publisher: string;
  title: string;
  url: string;
  published_at: string;
  summary: string;
  affected_story_slugs: string[];
  source_quality: number;
  relevance: number;
  novelty: number;
  materiality: number;
  candidate_score: number;
  recommended_action: string;
  transcript_status: string | null;
  video_review_status: string | null;
  transcript_motion_leads: unknown;
  divergence_note?: string | null;
  review_reason: string | null;
};

type MarketMotionSourceRef = {
  sourceName: string;
  sourceUrl: string;
  sourceKind: string;
  verificationState: MarketMotionVerificationState;
  role: "primary" | "discovery";
  sourceItemKey?: string | null;
};

export type MarketMotionIngestionResult = {
  considered: number;
  eligible: number;
  inserted: number;
  skippedExisting: number;
  creatorRowsConsidered: number;
  creatorLeadCandidates: number;
  motionIds: string[];
  warnings: string[];
};

export const MACRO_PULSE_MOTION_KINDS = [
  "AUCTION_SHOCK",
  "RATES_MOVE",
  "OIL_PRODUCTS_DIVERGENCE",
  "POLICY_SURPRISE",
  "CROSS_ASSET_DIVERGENCE",
] as const;

export type MacroPulseMotionKind = typeof MACRO_PULSE_MOTION_KINDS[number];

export type MacroPulseMotionReference = {
  sourceName: string;
  sourceUrl: string;
  sourceKind?: NonNullable<MarketMotionInput["sourceKind"]>;
  publishedAt?: string | null;
  claim?: string | null;
};

export type MacroPulseMotionCandidateInput = {
  candidateKey: string;
  kind: MacroPulseMotionKind;
  occurredAt: string;
  headline: string;
  whatHappened: string;
  marketReaction?: string | null;
  whyInteresting: string;
  nextTest: string;
  affectedStorySlugs?: string[];
  tickers?: string[];
  materiality: number;
  relevance: number;
  novelty: number;
  references?: MacroPulseMotionReference[];
};

export type MacroPulseMotionSubmission = {
  pulseId: string;
  pulseUrl: string;
  pulseAsOf: string;
  candidates: MacroPulseMotionCandidateInput[];
};

export class MacroPulseMotionInputError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(errors.join(" "));
    this.name = "MacroPulseMotionInputError";
    this.errors = errors;
  }
}

function cleanText(value: string | undefined | null, max: number) {
  return (value || "").replace(/\s+/g, " ").trim().slice(0, max);
}


const CREATOR_EVENT_LEAD_KINDS = new Set([
  "claim",
  "catalyst",
  "market_reaction",
  "threshold",
  "positioning",
  "technical_level",
]);

const EVENT_FAMILIES: Array<[string, RegExp]> = [
  ["ipo", /\b(?:ipo|initial public offering|s-?1|prospectus)\b/i],
  ["earnings", /\b(?:earnings|eps|quarterly results?|results? season)\b/i],
  ["guidance", /\b(?:guidance|outlook|forecast raised|forecast cut)\b/i],
  ["acquisition", /\b(?:acquisition|acquire[ds]?|takeover|merger)\b/i],
  ["buyback", /\b(?:buyback|share repurchase|repurchase authori[sz]ation)\b/i],
  ["regulation", /\b(?:regulation|regulatory|nhtsa|ftc|doj|antitrust|certification deadline)\b/i],
  ["contract", /\b(?:contract win|awarded? .*contract|contract award)\b/i],
  ["launch", /\b(?:product launch|launched|roll(?:ing)? out|new platform)\b/i],
  ["financing", /\b(?:financing|funding round|debt offering|convertible|capital raise)\b/i],
  ["layoffs", /\b(?:layoffs?|job cuts?|workforce reduction)\b/i],
  ["tariff", /\b(?:tariffs?|trade truce|export controls?)\b/i],
  ["diplomacy", /\b(?:ceasefire|peace talks?|negotiat(?:e|ion|ions)|trust-building|diplomatic)\b/i],
  ["cpi", /\b(?:consumer price index|cpi)\b/i],
  ["ppi", /\b(?:producer price index|ppi)\b/i],
  ["pce", /\b(?:personal consumption expenditures|pce)\b/i],
  ["jobs", /\b(?:nonfarm payrolls?|nfp|jobs report|payrolls)\b/i],
  ["fomc", /\b(?:fomc|fed decision|federal reserve decision)\b/i],
  ["auction", /\b(?:treasury auction|auction tail|auction stop|bid-to-cover|indirect bidders?)\b/i],
  ["rates_move", /\b(?:(?:2|5|10|20|30)[- ]?year treasury yield|(?:2y|5y|10y|20y|30y) yield|yield curve (?:steepen|flatten|bear|bull))\b/i],
  ["oil_products", /\b(?:crude[- ]products? divergence|oil[- ]products? divergence|distillate divergence|gasoline divergence|refined products? divergence)\b/i],
  ["policy_surprise", /\b(?:policy surprise|unexpected policy|surprise tariff|surprise sanction|unexpected tariff|unexpected sanction)\b/i],
];

const SUBJECT_STOPWORDS = new Set([
  "the", "inside", "why", "how", "what", "when", "where", "after", "before", "new", "latest",
  "reuters", "yahoo", "stockedup", "market", "markets", "consumer", "producer", "federal", "united",
  "ai", "ipo", "cpi", "ppi", "pce", "nfp", "fomc", "usd", "us", "uk", "eu",
]);

function asStringArray(value: unknown, limit = 20) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()))].slice(0, limit)
    : [];
}

function parseTranscriptMotionLeads(value: unknown): TranscriptMotionLead[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): TranscriptMotionLead[] => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const row = raw as Record<string, unknown>;
    const text = cleanText(typeof row.text === "string" ? row.text : "", 600);
    const kind = typeof row.kind === "string" ? row.kind : "";
    const priority = Math.max(0, Math.min(100, Math.round(Number(row.priority) || 0)));
    if (!text || !kind || !priority) return [];
    return [{
      kind: kind as TranscriptMotionLead["kind"],
      text,
      tags: asStringArray(row.tags, 16) as TranscriptMotionLead["tags"],
      entities: asStringArray(row.entities, 12),
      verificationNeeded: Boolean(row.verificationNeeded),
      verificationTarget: cleanText(typeof row.verificationTarget === "string" ? row.verificationTarget : null, 300) || null,
      searchPrompt: cleanText(typeof row.searchPrompt === "string" ? row.searchPrompt : null, 600) || null,
      articleHook: cleanText(typeof row.articleHook === "string" ? row.articleHook : null, 600) || null,
      priority,
    }];
  });
}

function sourceRank(kind: string | null | undefined) {
  if (kind === "primary" || kind === "official" || kind === "filing") return 6;
  if (kind === "reporting") return 5;
  if (kind === "market_data") return 4;
  if (kind === "creator") return 2;
  return 1;
}

function verificationRank(state: MarketMotionVerificationState | undefined) {
  if (state === "VERIFIED") return 6;
  if (state === "PARTIAL") return 5;
  if (state === "REPORTED") return 4;
  if (state === "LEAD") return 3;
  if (state === "UNRESOLVED") return 2;
  if (state === "CONTRADICTED") return 1;
  return 0;
}

function sourceRef(candidate: MarketMotionInput): MarketMotionSourceRef {
  const metadata = candidate.metadata || {};
  return {
    sourceName: candidate.sourceName,
    sourceUrl: candidate.sourceUrl,
    sourceKind: candidate.sourceKind || "other",
    verificationState: candidate.verificationState || "LEAD",
    role: candidate.sourceKind === "creator" ? "discovery" : "primary",
    sourceItemKey: typeof metadata.itemKey === "string" ? metadata.itemKey : null,
  };
}

function sourceRefs(metadata: Record<string, unknown> | undefined) {
  if (!metadata || !Array.isArray(metadata.sourceRefs)) return [];
  return metadata.sourceRefs.flatMap((raw): MarketMotionSourceRef[] => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const row = raw as Record<string, unknown>;
    if (typeof row.sourceName !== "string" || typeof row.sourceUrl !== "string" || typeof row.sourceKind !== "string") return [];
    return [{
      sourceName: row.sourceName,
      sourceUrl: row.sourceUrl,
      sourceKind: row.sourceKind,
      verificationState: (typeof row.verificationState === "string" ? row.verificationState : "LEAD") as MarketMotionVerificationState,
      role: row.role === "discovery" ? "discovery" : "primary",
      sourceItemKey: typeof row.sourceItemKey === "string" ? row.sourceItemKey : null,
    }];
  });
}

function uniqueSourceRefs(refs: MarketMotionSourceRef[]) {
  const byKey = new Map<string, MarketMotionSourceRef>();
  for (const ref of refs) {
    const key = ref.sourceUrl || `${ref.sourceName}:${ref.sourceItemKey || ""}`;
    const prior = byKey.get(key);
    if (!prior || sourceRank(ref.sourceKind) > sourceRank(prior.sourceKind)) byKey.set(key, ref);
  }
  return [...byKey.values()];
}

function metadataStrings(metadata: Record<string, unknown> | undefined, field: string, limit = 12) {
  if (!metadata) return [];
  return asStringArray(metadata[field], limit);
}

function candidateStrength(candidate: MarketMotionInput) {
  return sourceRank(candidate.sourceKind) * 1_000_000
    + verificationRank(candidate.verificationState) * 10_000
    + Number(candidate.materiality || 0) * 100
    + Number(candidate.relevance || 0);
}

function strongerVerification(left: MarketMotionVerificationState | undefined, right: MarketMotionVerificationState | undefined) {
  return verificationRank(left) >= verificationRank(right) ? (left || "LEAD") : (right || "LEAD");
}

function normalizeSubject(value: string) {
  return value.toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function properSubject(headline: string) {
  const matches = headline.match(/\b[A-Z][A-Za-z0-9&.-]{1,24}\b/g) || [];
  for (const value of matches) {
    const normalized = normalizeSubject(value);
    if (normalized && !SUBJECT_STOPWORDS.has(normalized)) return normalized;
  }
  return null;
}

function eventFamily(text: string) {
  return EVENT_FAMILIES.find(([, pattern]) => pattern.test(text))?.[0] || null;
}

function eventMotionKey(candidate: MarketMotionInput) {
  const metadata = candidate.metadata || {};
  const explicitFamily = typeof metadata.eventFamily === "string" ? metadata.eventFamily.trim() : "";
  const family = explicitFamily || eventFamily(`${candidate.headline} ${candidate.whatHappened}`);
  if (!family) return candidate.motionKey;
  const entities = metadataStrings(metadata, "entities", 8);
  const entitySubject = entities.map(normalizeSubject).find((value) => value && !SUBJECT_STOPWORDS.has(value)) || null;
  const subject = entitySubject || properSubject(candidate.headline) || candidate.tickers?.map(normalizeSubject).find(Boolean) || null;
  if (!subject) {
    if (["cpi", "ppi", "pce", "jobs", "fomc"].includes(family)) {
      return `event:${family}:${candidate.occurredAt.slice(0, 10)}`;
    }
    return candidate.motionKey;
  }
  return `event:${family}:${subject}`.slice(0, 300);
}

function mergedMetadata(primary: MarketMotionInput, secondary: MarketMotionInput) {
  const left = primary.metadata || {};
  const right = secondary.metadata || {};
  const refs = uniqueSourceRefs([
    ...sourceRefs(left),
    sourceRef(primary),
    ...sourceRefs(right),
    sourceRef(secondary),
  ]);
  return {
    ...right,
    ...left,
    sourceRefs: refs,
    writingAngles: [...new Set([...metadataStrings(left, "writingAngles"), ...metadataStrings(right, "writingAngles")])].slice(0, 8),
    researchQuestions: [...new Set([...metadataStrings(left, "researchQuestions"), ...metadataStrings(right, "researchQuestions")])].slice(0, 8),
    creatorInterpretations: [...new Set([...metadataStrings(left, "creatorInterpretations"), ...metadataStrings(right, "creatorInterpretations")])].slice(0, 8),
    creatorLeadTexts: [...new Set([...metadataStrings(left, "creatorLeadTexts"), ...metadataStrings(right, "creatorLeadTexts")])].slice(0, 12),
    originItemKeys: [...new Set([
      ...metadataStrings(left, "originItemKeys"),
      ...metadataStrings(right, "originItemKeys"),
      ...(typeof left.itemKey === "string" ? [left.itemKey] : []),
      ...(typeof right.itemKey === "string" ? [right.itemKey] : []),
    ])].slice(0, 20),
  };
}

function mergeCandidatePair(left: MarketMotionInput, right: MarketMotionInput): MarketMotionInput {
  const primary = candidateStrength(left) >= candidateStrength(right) ? left : right;
  const secondary = primary === left ? right : left;
  const metadata = mergedMetadata(primary, secondary);
  const researchQuestions = metadataStrings(metadata, "researchQuestions");
  const primaryHasSpecificTest = Boolean(primary.nextTest && !/^Seek independent|^Check whether/i.test(primary.nextTest));
  return {
    ...primary,
    motionKey: left.motionKey,
    verificationState: strongerVerification(left.verificationState, right.verificationState),
    tickers: [...new Set([...(left.tickers || []), ...(right.tickers || [])])].slice(0, 20),
    materiality: Math.max(Number(left.materiality || 0), Number(right.materiality || 0)),
    relevance: Math.max(Number(left.relevance || 0), Number(right.relevance || 0)),
    novelty: Math.max(Number(left.novelty || 0), Number(right.novelty || 0)),
    occurredAt: new Date(Math.min(Date.parse(left.occurredAt), Date.parse(right.occurredAt))).toISOString(),
    observedAt: new Date(Math.max(Date.parse(left.observedAt || left.occurredAt), Date.parse(right.observedAt || right.occurredAt))).toISOString(),
    nextTest: primaryHasSpecificTest ? primary.nextTest : (researchQuestions[0] || secondary.nextTest || primary.nextTest || null),
    primaryStoryId: primary.primaryStoryId || secondary.primaryStoryId || null,
    primaryRegimeSlug: primary.primaryRegimeSlug || secondary.primaryRegimeSlug || null,
    researchRunId: primary.researchRunId || secondary.researchRunId || null,
    metadata,
  };
}

function recordAsInput(row: MarketMotionRecord): MarketMotionInput {
  return {
    motionKey: row.motion_key,
    lifecycleState: row.lifecycle_state,
    category: row.category,
    verificationState: row.verification_state,
    headline: row.headline,
    whatHappened: row.what_happened,
    marketReaction: row.market_reaction,
    whyInteresting: row.why_interesting,
    bigPictureBridge: row.big_picture_bridge,
    nextTest: row.next_test,
    promotionReason: row.promotion_reason,
    tickers: row.tickers,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    sourceKind: row.source_kind as MarketMotionInput["sourceKind"],
    materiality: row.materiality,
    relevance: row.relevance,
    novelty: row.novelty,
    occurredAt: row.occurred_at,
    observedAt: row.observed_at,
    expiresAt: row.expires_at,
    researchRunId: row.research_run_id,
    sourceId: row.source_id,
    evidenceId: row.evidence_id,
    primaryStoryId: row.primary_story_id,
    primaryRegimeSlug: row.primary_regime_slug,
    metadata: row.metadata || {},
  };
}

function contextSignature(metadata: Record<string, unknown> | undefined) {
  return JSON.stringify({
    sourceRefs: uniqueSourceRefs(sourceRefs(metadata)),
    writingAngles: metadataStrings(metadata, "writingAngles"),
    researchQuestions: metadataStrings(metadata, "researchQuestions"),
    creatorInterpretations: metadataStrings(metadata, "creatorInterpretations"),
    creatorLeadTexts: metadataStrings(metadata, "creatorLeadTexts"),
  });
}

function sourceHost(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function sourceKind(item: ScoredIntakeItem): NonNullable<MarketMotionInput["sourceKind"]> {
  if (item.itemType === "video") return "creator";
  const host = sourceHost(item.url);
  if (/^(?:www\.)?sec\.gov$/.test(host)) return "filing";
  if (
    /(?:^|\.)(?:bls\.gov|bea\.gov|treasury\.gov|energy\.gov|federalreserve\.gov|newyorkfed\.org|ecb\.europa\.eu|boj\.or\.jp|mof\.go\.jp|statcan\.gc\.ca|ons\.gov\.uk|eurostat\.ec\.europa\.eu|abs\.gov\.au|stats\.govt\.nz|rba\.gov\.au|bankofengland\.co\.uk|bankofcanada\.ca|snb\.ch|imf\.org|bis\.org)$/.test(host)
  ) return "official";
  return "reporting";
}

function verificationState(
  item: ScoredIntakeItem,
  kind: NonNullable<MarketMotionInput["sourceKind"]>,
): MarketMotionVerificationState {
  if ((kind === "official" || kind === "filing" || kind === "primary") && item.sourceQuality >= 90) {
    return "VERIFIED";
  }
  return "REPORTED";
}

function categoryFor(text: string): MarketMotionCategory {
  if (/\b(earnings|eps|revenue|guidance|quarter|results|margin|free cash flow|fcf)\b/i.test(text)) return "EARNINGS";
  if (/\b(iran|hormuz|war|conflict|sanction|ceasefire|missile|military|tariff|trade war)\b/i.test(text)) return "GEOPOLITICS";
  if (/\b(oil|brent|wti|crude|diesel|distillate|lng|gasoline|refiner|refinery|energy security)\b/i.test(text)) return "ENERGY";
  if (/\b(gold|silver|copper|commodity|commodities|metals?)\b/i.test(text)) return "COMMODITY";
  if (/\b(cpi|ppi|pce|payroll|nfp|jobs|employment|gdp|pmi|ism|inflation|growth|treasury|yield|rates?|fed|fomc|boj|ecb|central bank)\b/i.test(text)) return "MACRO";
  if (/\b(policy|regulation|regulatory|government|administration|ministry|tax|subsidy|export control)\b/i.test(text)) return "POLICY";
  if (/\b(breadth|liquidity|market structure|volatility|vix|move index|auction|buyback|positioning)\b/i.test(text)) return "MARKET_STRUCTURE";
  if (/\b(sector|industry|semiconductor|memory|utilities|financials|technology|consumer discretionary)\b/i.test(text)) return "SECTOR";
  if (/\b(company|shares?|stock|acquisition|merger|launch|contract|partnership|customer|capex|investment)\b/i.test(text)) return "COMPANY";
  return "OTHER";
}

function eligible(item: ScoredIntakeItem, now: Date) {
  // Gap research is admitted back into canonical Live through the handoff path.
  // Do not turn that same handoff into new Motion or Motion -> Gap can recurse.
  if (parseResearchGapHandoffContext(item.divergenceNote)) return false;

  const publishedAt = Date.parse(item.publishedAt);
  if (!Number.isFinite(publishedAt)) return false;
  if (publishedAt > now.getTime() + 5 * 60_000) return false;
  if (now.getTime() - publishedAt > MARKET_MOTION_FRESHNESS_HOURS * 60 * 60 * 1_000) return false;
  if (!["collect_evidence", "review_article", "recalibrate_story"].includes(item.recommendedAction)) return false;
  if (item.candidateScore < MARKET_MOTION_MIN_SCORE) return false;
  if (item.materiality < MARKET_MOTION_MIN_MATERIALITY) return false;
  if (item.relevance < MARKET_MOTION_MIN_RELEVANCE) return false;
  if (item.novelty < MARKET_MOTION_MIN_NOVELTY) return false;

  if (item.itemType === "video") {
    return item.transcriptStatus === "ready" && cleanText(item.transcriptText, 500).length >= 200;
  }
  return item.evidence.length > 0;
}

function exactStory(
  item: ScoredIntakeItem,
  stories: StoryRef[],
) {
  const bySlug = new Map(stories.map((story) => [story.slug, story]));
  for (const slug of item.affectedStorySlugs || []) {
    const story = bySlug.get(slug);
    if (story) return story;
  }
  return null;
}

function bridgeFor(input: {
  regimeSlug: RegimeSlug | null;
  story: StoryRef | null;
}) {
  const regime = input.regimeSlug ? getRegimeDefinition(input.regimeSlug) : null;
  if (regime) {
    const map: Partial<Record<RegimeSlug, string>> = {
      "us-china-ai": "Fresh AI / technology evidence → supply, demand or financing channel → US–China AI regime",
      "energy-security-inflation": "Fresh energy / geopolitical evidence → physical supply and inflation channel → Energy Security regime",
      "global-cost-of-capital": "Fresh rates / funding evidence → sovereign yields and financing costs → Cost of Capital regime",
      "gold-reserve-diversification": "Fresh reserve / real-yield evidence → gold demand and opportunity cost → Gold / Reserves regime",
      "equity-rally-quality": "Fresh company / sector evidence → earnings breadth and market participation → Equity Rally Quality regime",
    };
    return map[input.regimeSlug!] || `Fresh event → ${regime.shortTitle} → test whether the durable regime needs recalibration`;
  }
  if (input.story) {
    return `Fresh event → tests ${input.story.title} → wait for confirmation or contradiction before changing the durable Story`;
  }
  return "Fresh event → market relevance test → corroborate before attaching it to a durable Story or Regime";
}

function nextTestFor(
  item: ScoredIntakeItem,
  verification: MarketMotionVerificationState,
) {
  const reason = cleanText(item.reviewReason, 500);
  if (reason) return reason;
  if (verification === "VERIFIED") {
    return "Check whether the linked assets and broader Story / Regime reaction confirm the information.";
  }
  return "Seek independent or primary-source confirmation, then test whether the market reaction persists.";
}

function whyInterestingFor(
  item: ScoredIntakeItem,
  story: StoryRef | null,
  regimeSlug: RegimeSlug | null,
) {
  const signal = cleanText(item.newsSignal || item.reviewReason, 900);
  if (signal) return signal;
  if (story) return `Fresh evidence may confirm, challenge or refine the existing Story: ${story.title}.`;
  const regime = regimeSlug ? getRegimeDefinition(regimeSlug) : null;
  if (regime) return `Fresh evidence may affect the current ${regime.shortTitle} interpretation.`;
  return "Fresh, high-materiality evidence cleared the intake gate and warrants short-horizon monitoring.";
}

export function buildMarketMotionCandidates(
  items: ScoredIntakeItem[],
  stories: StoryRef[],
  options: { now?: Date; researchRunId?: string | null } = {},
): MarketMotionInput[] {
  const now = options.now ?? new Date();

  return items
    .filter((item) => eligible(item, now))
    .sort((left, right) =>
      right.candidateScore - left.candidateScore
      || right.materiality - left.materiality
      || right.relevance - left.relevance
      || right.novelty - left.novelty
      || Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
    .slice(0, MARKET_MOTION_RUN_LIMIT)
    .map((item) => {
      const text = [
        item.title,
        item.summary,
        item.newsSignal || "",
        item.statsSignal || "",
        item.divergenceNote || "",
        item.reviewReason || "",
        ...(item.evidence || []).map((link) => link.claim),
      ].join(" ");
      const links = resolveMarketMotionLinks({
        text,
        affectedStorySlugs: item.affectedStorySlugs,
        stories,
      });
      const story = exactStory(item, stories);
      const kind = sourceKind(item);
      const verification = verificationState(item, kind);
      const tickers = explicitlyMentionedInstrumentSpecs(text).map((spec) => spec.instrument);

      return {
        motionKey: `intake:${item.itemKey}`,
        lifecycleState: "MOTION",
        category: categoryFor(text),
        verificationState: verification,
        headline: cleanText(item.title, 500),
        whatHappened: cleanText(item.summary || item.evidence[0]?.claim, 3_600),
        marketReaction: null,
        whyInteresting: whyInterestingFor(item, story, links.primaryRegimeSlug),
        bigPictureBridge: bridgeFor({
          regimeSlug: links.primaryRegimeSlug,
          story,
        }),
        nextTest: nextTestFor(item, verification),
        tickers,
        sourceName: cleanText(item.publisher, 300),
        sourceUrl: item.url,
        sourceKind: kind,
        materiality: item.materiality,
        relevance: item.relevance,
        novelty: item.novelty,
        occurredAt: item.publishedAt,
        observedAt: now.toISOString(),
        researchRunId: options.researchRunId || null,
        primaryStoryId: links.primaryStoryId,
        primaryRegimeSlug: links.primaryRegimeSlug,
        metadata: {
          itemKey: item.itemKey,
          itemType: item.itemType,
          candidateScore: item.candidateScore,
          recommendedAction: item.recommendedAction,
          affectedStorySlugs: item.affectedStorySlugs || [],
          primaryRegimeSubgroup: links.primaryRegimeSubgroup,
          evidenceUrls: item.evidence.map((link) => link.url).slice(0, 8),
          sourceRefs: [{
            sourceName: cleanText(item.publisher, 300),
            sourceUrl: item.url,
            sourceKind: kind,
            verificationState: verification,
            role: kind === "creator" ? "discovery" : "primary",
            sourceItemKey: item.itemKey,
          }],
          originItemKeys: [item.itemKey],
          ingestion: "research-update/v1",
        },
      };
    });
}



const MACRO_PULSE_MAX_CANDIDATES = MARKET_MOTION_RUN_LIMIT;

function validHttps(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function macroPulseEventFamily(kind: MacroPulseMotionKind) {
  if (kind === "AUCTION_SHOCK") return "auction";
  if (kind === "RATES_MOVE") return "rates_move";
  if (kind === "OIL_PRODUCTS_DIVERGENCE") return "oil_products";
  if (kind === "POLICY_SURPRISE") return "policy_surprise";
  return "cross_asset_divergence";
}

function macroPulseCategory(kind: MacroPulseMotionKind): MarketMotionCategory {
  if (kind === "OIL_PRODUCTS_DIVERGENCE") return "ENERGY";
  if (kind === "POLICY_SURPRISE") return "POLICY";
  if (kind === "CROSS_ASSET_DIVERGENCE") return "MARKET_STRUCTURE";
  return "MACRO";
}

function validateMacroPulseMotionSubmission(
  submission: MacroPulseMotionSubmission,
  now: Date,
) {
  const errors: string[] = [];
  const pulseId = cleanText(submission?.pulseId, 120);
  const pulseUrl = cleanText(submission?.pulseUrl, 2_000);
  const pulseAsOf = Date.parse(submission?.pulseAsOf || "");
  const candidates = Array.isArray(submission?.candidates) ? submission.candidates : [];

  if (!pulseId) errors.push("pulseId is required and must be at most 120 characters.");
  if (!pulseUrl || !validHttps(pulseUrl)) errors.push("pulseUrl must be a credential-free HTTPS URL.");
  if (!Number.isFinite(pulseAsOf)) errors.push("pulseAsOf must be a valid timestamp.");
  if (!candidates.length) errors.push("At least one Macro Pulse candidate is required.");
  if (candidates.length > MACRO_PULSE_MAX_CANDIDATES) {
    errors.push(`At most ${MACRO_PULSE_MAX_CANDIDATES} Macro Pulse candidates may be submitted at once.`);
  }

  const seen = new Set<string>();
  candidates.forEach((candidate, index) => {
    const prefix = `candidates[${index}]`;
    const key = cleanText(candidate?.candidateKey, 120);
    const occurred = Date.parse(candidate?.occurredAt || "");
    if (!key) errors.push(`${prefix}.candidateKey is required and must be at most 120 characters.`);
    else if (seen.has(key)) errors.push(`${prefix}.candidateKey is duplicated.`);
    else seen.add(key);
    if (!MACRO_PULSE_MOTION_KINDS.includes(candidate?.kind as MacroPulseMotionKind)) errors.push(`${prefix}.kind is invalid.`);
    if (!Number.isFinite(occurred)) errors.push(`${prefix}.occurredAt must be a valid timestamp.`);
    else {
      if (occurred > now.getTime() + 5 * 60_000) errors.push(`${prefix}.occurredAt cannot be materially in the future.`);
      if (now.getTime() - occurred > MARKET_MOTION_FRESHNESS_HOURS * 60 * 60 * 1_000) errors.push(`${prefix} is outside the ${MARKET_MOTION_FRESHNESS_HOURS}-hour Motion window.`);
    }
    if (!cleanText(candidate?.headline, 500)) errors.push(`${prefix}.headline is required.`);
    if (!cleanText(candidate?.whatHappened, 3_600)) errors.push(`${prefix}.whatHappened is required.`);
    if (!cleanText(candidate?.whyInteresting, 1_200)) errors.push(`${prefix}.whyInteresting is required.`);
    if (!cleanText(candidate?.nextTest, 1_200)) errors.push(`${prefix}.nextTest is required because Macro Pulse is discovery, not evidence.`);
    for (const field of ["materiality", "relevance", "novelty"] as const) {
      const value = Number(candidate?.[field]);
      if (!Number.isInteger(value) || value < 0 || value > 100) errors.push(`${prefix}.${field} must be an integer from 0 to 100.`);
    }
    if (Number(candidate?.materiality) < MARKET_MOTION_MIN_MATERIALITY) errors.push(`${prefix}.materiality is below the Motion threshold.`);
    if (Number(candidate?.relevance) < MARKET_MOTION_MIN_RELEVANCE) errors.push(`${prefix}.relevance is below the Motion threshold.`);
    if (Number(candidate?.novelty) < MARKET_MOTION_MIN_NOVELTY) errors.push(`${prefix}.novelty is below the Motion threshold.`);

    const references = Array.isArray(candidate?.references) ? candidate.references : [];
    if (references.length > 12) errors.push(`${prefix}.references may contain at most 12 discovery references.`);
    references.forEach((reference, refIndex) => {
      if (!cleanText(reference?.sourceName, 300)) errors.push(`${prefix}.references[${refIndex}].sourceName is required.`);
      if (!validHttps(cleanText(reference?.sourceUrl, 2_000))) errors.push(`${prefix}.references[${refIndex}].sourceUrl must be HTTPS.`);
      if (reference?.publishedAt && !Number.isFinite(Date.parse(reference.publishedAt))) errors.push(`${prefix}.references[${refIndex}].publishedAt must be a valid timestamp when supplied.`);
    });
  });

  if (errors.length) throw new MacroPulseMotionInputError(errors);
}

export function buildMacroPulseMotionCandidates(
  submission: MacroPulseMotionSubmission,
  stories: StoryRef[],
  options: { now?: Date } = {},
): MarketMotionInput[] {
  const now = options.now ?? new Date();
  validateMacroPulseMotionSubmission(submission, now);

  return submission.candidates.map((candidate) => {
    const references = (candidate.references || []).slice(0, 12);
    const affectedStorySlugs = asStringArray(candidate.affectedStorySlugs, 12);
    const text = [
      candidate.headline,
      candidate.whatHappened,
      candidate.marketReaction || "",
      candidate.whyInteresting,
      candidate.nextTest,
      ...references.map((reference) => reference.claim || ""),
    ].join(" ");
    const links = resolveMarketMotionLinks({
      text,
      affectedStorySlugs,
      stories,
    });
    const story = exactStory({
      ...({ affectedStorySlugs } as ScoredIntakeItem),
    }, stories);
    const detectedTickers = explicitlyMentionedInstrumentSpecs(text).map((spec) => spec.instrument);
    const tickers = [...new Set([
      ...asStringArray(candidate.tickers, 20).map((ticker) => ticker.toUpperCase()),
      ...detectedTickers,
    ])].slice(0, 20);
    const eventFamily = macroPulseEventFamily(candidate.kind);

    return {
      motionKey: `macropulse:${cleanText(submission.pulseId, 120)}:${cleanText(candidate.candidateKey, 120)}`,
      lifecycleState: "MOTION",
      category: macroPulseCategory(candidate.kind),
      verificationState: "LEAD",
      headline: cleanText(candidate.headline, 500),
      whatHappened: cleanText(candidate.whatHappened, 3_600),
      marketReaction: cleanText(candidate.marketReaction, 1_200) || null,
      whyInteresting: cleanText(candidate.whyInteresting, 1_200),
      bigPictureBridge: bridgeFor({
        regimeSlug: links.primaryRegimeSlug,
        story,
      }),
      nextTest: cleanText(candidate.nextTest, 1_200),
      tickers,
      sourceName: "Macro Pulse",
      sourceUrl: submission.pulseUrl,
      sourceKind: "other",
      materiality: candidate.materiality,
      relevance: candidate.relevance,
      novelty: candidate.novelty,
      occurredAt: candidate.occurredAt,
      observedAt: now.toISOString(),
      primaryStoryId: links.primaryStoryId,
      primaryRegimeSlug: links.primaryRegimeSlug,
      metadata: {
        ingestion: "macro-pulse-motion-candidate/v1",
        pulseId: submission.pulseId,
        pulseAsOf: new Date(submission.pulseAsOf).toISOString(),
        pulseCandidateKey: candidate.candidateKey,
        pulseCandidateKind: candidate.kind,
        eventFamily,
        affectedStorySlugs,
        primaryRegimeSubgroup: links.primaryRegimeSubgroup,
        researchQuestions: [cleanText(candidate.nextTest, 1_200)],
        sourceRefs: [
          {
            sourceName: "Macro Pulse",
            sourceUrl: submission.pulseUrl,
            sourceKind: "other",
            verificationState: "LEAD",
            role: "discovery",
            sourceItemKey: `macropulse:${submission.pulseId}:${candidate.candidateKey}`,
          },
          ...references.map((reference) => ({
            sourceName: cleanText(reference.sourceName, 300),
            sourceUrl: reference.sourceUrl,
            sourceKind: reference.sourceKind || "other",
            verificationState: "LEAD" as const,
            role: "discovery" as const,
            sourceItemKey: null,
          })),
        ],
        originItemKeys: [`macropulse:${submission.pulseId}:${candidate.candidateKey}`],
      },
    };
  });
}

function creatorRowEligible(row: ReviewedTranscriptMotionRow, now: Date) {
  if (parseResearchGapHandoffContext(row.divergence_note)) return false;
  const publishedAt = Date.parse(row.published_at);
  return Number.isFinite(publishedAt)
    && publishedAt <= now.getTime() + 5 * 60_000
    && now.getTime() - publishedAt <= MARKET_MOTION_FRESHNESS_HOURS * 60 * 60 * 1_000
    && row.transcript_status === "ready"
    && row.video_review_status === "reviewed";
}

function storyForSlugs(slugs: string[], stories: StoryRef[]) {
  const bySlug = new Map(stories.map((story) => [story.slug, story]));
  return slugs.map((slug) => bySlug.get(slug)).find(Boolean) || null;
}

export function buildTranscriptMotionCandidates(
  rows: ReviewedTranscriptMotionRow[],
  stories: StoryRef[],
  options: { now?: Date; researchRunId?: string | null } = {},
): MarketMotionInput[] {
  const now = options.now ?? new Date();
  const candidates: MarketMotionInput[] = [];

  for (const row of rows) {
    if (!creatorRowEligible(row, now)) continue;
    const leads = parseTranscriptMotionLeads(row.transcript_motion_leads);
    const writingAngles = leads.filter((lead) => lead.kind === "article_hook").map((lead) => lead.articleHook || lead.text).filter(Boolean).slice(0, 8);
    const researchQuestions = leads.filter((lead) => lead.kind === "research_question").map((lead) => lead.searchPrompt || lead.text).filter(Boolean).slice(0, 8);
    const creatorInterpretations = leads
      .filter((lead) => ["causal_link", "countercase"].includes(lead.kind))
      .map((lead) => lead.text)
      .slice(0, 8);
    const eventLeads = leads
      .filter((lead) => CREATOR_EVENT_LEAD_KINDS.has(lead.kind))
      .filter((lead) => lead.priority >= MARKET_MOTION_MIN_SCORE)
      .sort((left, right) => right.priority - left.priority)
      .slice(0, 8);

    for (const lead of eventLeads) {
      const text = [lead.text, row.title, row.summary, ...lead.entities].join(" ");
      const links = resolveMarketMotionLinks({
        text,
        affectedStorySlugs: row.affected_story_slugs || [],
        stories,
      });
      const story = storyForSlugs(row.affected_story_slugs || [], stories);
      const tickers = explicitlyMentionedInstrumentSpecs(text).map((spec) => spec.instrument);
      const leadKey = createHash("sha256").update(`${row.item_key}\n${lead.text}`).digest("hex").slice(0, 16);
      const whyInteresting = writingAngles[0]
        ? `Transcript writing angle: ${writingAngles[0]}`
        : story
          ? `Creator research lead may add a fresh test to the existing Story: ${story.title}.`
          : "Creator transcript surfaced a discrete event, statistic or market claim worth current verification.";

      candidates.push({
        motionKey: `creator:${row.item_key}:${leadKey}`.slice(0, 300),
        lifecycleState: "MOTION",
        category: categoryFor(text),
        verificationState: "LEAD",
        headline: cleanText(lead.text, 500),
        whatHappened: cleanText(`${row.publisher} surfaced this in a recent transcript. It remains a creator-sourced lead until independently corroborated: ${lead.text}`, 3_600),
        marketReaction: lead.kind === "market_reaction" ? cleanText(lead.text, 1_200) : null,
        whyInteresting,
        bigPictureBridge: bridgeFor({ regimeSlug: links.primaryRegimeSlug, story }),
        nextTest: lead.searchPrompt || lead.verificationTarget || researchQuestions[0] || "Verify the creator lead with a primary source or high-quality current reporting.",
        tickers,
        sourceName: cleanText(row.publisher, 300),
        sourceUrl: row.url,
        sourceKind: "creator",
        materiality: Math.max(Number(row.materiality || 0), lead.priority),
        relevance: Math.max(Number(row.relevance || 0), lead.priority),
        novelty: Math.max(Number(row.novelty || 0), lead.priority),
        occurredAt: row.published_at,
        observedAt: now.toISOString(),
        researchRunId: options.researchRunId || row.run_id || null,
        primaryStoryId: links.primaryStoryId,
        primaryRegimeSlug: links.primaryRegimeSlug,
        metadata: {
          itemKey: row.item_key,
          itemType: "video",
          intakeItemId: row.id,
          originResearchRunId: row.run_id,
          creatorVideoTitle: row.title,
          creatorLeadKind: lead.kind,
          creatorLeadPriority: lead.priority,
          verificationNeeded: lead.verificationNeeded,
          verificationTarget: lead.verificationTarget,
          tags: lead.tags,
          entities: lead.entities,
          writingAngles,
          researchQuestions,
          creatorInterpretations,
          creatorLeadTexts: [lead.text],
          originItemKeys: [row.item_key],
          sourceRefs: [{
            sourceName: row.publisher,
            sourceUrl: row.url,
            sourceKind: "creator",
            verificationState: "LEAD",
            role: "discovery",
            sourceItemKey: row.item_key,
          }],
          affectedStorySlugs: row.affected_story_slugs || [],
          primaryRegimeSubgroup: links.primaryRegimeSubgroup,
          ingestion: "creator-transcript-motion-lead/v1",
        },
      });
    }
  }

  return candidates
    .sort((left, right) =>
      Number(right.materiality || 0) - Number(left.materiality || 0)
      || Number(right.relevance || 0) - Number(left.relevance || 0)
      || Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
    .slice(0, MARKET_MOTION_RUN_LIMIT);
}

export function unifyMarketMotionCandidates(
  candidates: MarketMotionInput[],
  options: { researchRunId?: string | null } = {},
) {
  const byEvent = new Map<string, MarketMotionInput>();

  for (const raw of candidates) {
    const motionKey = eventMotionKey(raw);
    const candidate: MarketMotionInput = {
      ...raw,
      motionKey,
      researchRunId: options.researchRunId ?? raw.researchRunId ?? null,
      metadata: {
        ...(raw.metadata || {}),
        eventIdentity: motionKey.startsWith("event:") ? motionKey : null,
        sourceRefs: uniqueSourceRefs([
          ...sourceRefs(raw.metadata),
          sourceRef(raw),
        ]),
      },
    };
    const prior = byEvent.get(motionKey);
    byEvent.set(motionKey, prior ? mergeCandidatePair(prior, candidate) : candidate);
  }

  return [...byEvent.values()]
    .sort((left, right) =>
      candidateStrength(right) - candidateStrength(left)
      || Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
    .slice(0, MARKET_MOTION_RUN_LIMIT);
}

function sameCore(existing: MarketMotionRecord, candidate: MarketMotionInput) {
  return existing.lifecycle_state === (candidate.lifecycleState || "MOTION")
    && existing.verification_state === (candidate.verificationState || "LEAD")
    && existing.headline === candidate.headline
    && existing.what_happened === candidate.whatHappened
    && existing.market_reaction === (candidate.marketReaction || null)
    && existing.why_interesting === candidate.whyInteresting
    && existing.big_picture_bridge === candidate.bigPictureBridge
    && existing.next_test === (candidate.nextTest || null)
    && existing.source_url === candidate.sourceUrl
    && existing.primary_story_id === (candidate.primaryStoryId || null)
    && existing.primary_regime_slug === (candidate.primaryRegimeSlug || null)
    && existing.research_run_id === (candidate.researchRunId || null)
    && contextSignature(existing.metadata) === contextSignature(candidate.metadata);
}


async function loadStories(db: SupabaseClient): Promise<StoryRef[]> {
  const { data, error } = await db
    .from("stories")
    .select("id,slug,title")
    .neq("status", "archived");
  if (error) throw new Error(`Market Motion could not read canonical Stories: ${error.message}`);
  return (data || []) as StoryRef[];
}

async function loadRecentReviewedTranscripts(input: {
  db: SupabaseClient;
  now: Date;
  intakeItemIds?: string[];
}): Promise<ReviewedTranscriptMotionRow[]> {
  const cutoff = new Date(input.now.getTime() - MARKET_MOTION_FRESHNESS_HOURS * 60 * 60 * 1_000).toISOString();
  let query = input.db
    .from("research_intake_items")
    .select("id,run_id,item_key,publisher,title,url,published_at,summary,affected_story_slugs,source_quality,relevance,novelty,materiality,candidate_score,recommended_action,transcript_status,video_review_status,transcript_motion_leads,divergence_note,review_reason")
    .eq("item_type", "video")
    .eq("transcript_status", "ready")
    .eq("video_review_status", "reviewed")
    .gte("published_at", cutoff)
    .order("published_at", { ascending: false });

  if (input.intakeItemIds?.length) query = query.in("id", [...new Set(input.intakeItemIds)]);
  const { data, error } = await query.limit(100);
  if (error) throw new Error(`Market Motion could not read transcript leads: ${error.message}`);
  return (data || []) as ReviewedTranscriptMotionRow[];
}

async function persistUnifiedCandidates(input: {
  candidates: MarketMotionInput[];
  db: SupabaseClient;
  considered: number;
  creatorRowsConsidered: number;
  creatorLeadCandidates: number;
  warnings: string[];
}): Promise<MarketMotionIngestionResult> {
  if (!input.candidates.length) {
    return {
      considered: input.considered,
      eligible: 0,
      inserted: 0,
      skippedExisting: 0,
      creatorRowsConsidered: input.creatorRowsConsidered,
      creatorLeadCandidates: input.creatorLeadCandidates,
      motionIds: [],
      warnings: input.warnings,
    };
  }

  const keys = input.candidates.map((candidate) => candidate.motionKey);
  const { data: existingRows, error: existingError } = await input.db
    .from("current_market_motion_items")
    .select("*")
    .in("motion_key", keys);

  if (existingError) {
    throw new Error(`Market Motion could not inspect current motion: ${existingError.message}`);
  }

  const existingByKey = new Map(
    ((existingRows || []) as MarketMotionRecord[]).map((row) => [row.motion_key, row]),
  );

  const motionIds: string[] = [];
  let skippedExisting = 0;

  for (const rawCandidate of input.candidates) {
    const prior = existingByKey.get(rawCandidate.motionKey);
    const candidate = prior
      ? {
          ...mergeCandidatePair(rawCandidate, recordAsInput(prior)),
          motionKey: rawCandidate.motionKey,
          researchRunId: rawCandidate.researchRunId || prior.research_run_id,
          observedAt: rawCandidate.observedAt || new Date().toISOString(),
          // Existing explicit expiry belongs to the previous version. Let the new version
          // recalculate its 48h expiry from the merged occurrence/observation timestamps.
          expiresAt: null,
        }
      : rawCandidate;

    if (prior && sameCore(prior, candidate)) {
      skippedExisting += 1;
      continue;
    }

    try {
      const row = await persistMarketMotion(candidate, input.db);
      motionIds.push(row.id);
      existingByKey.set(row.motion_key, row);
    } catch (error) {
      input.warnings.push(error instanceof Error ? error.message : `Market Motion failed for ${candidate.motionKey}.`);
    }
  }

  return {
    considered: input.considered,
    eligible: input.candidates.length,
    inserted: motionIds.length,
    skippedExisting,
    creatorRowsConsidered: input.creatorRowsConsidered,
    creatorLeadCandidates: input.creatorLeadCandidates,
    motionIds,
    warnings: input.warnings,
  };
}

export async function persistMarketMotionFromResearchRun(input: {
  researchRunId: string;
  items: ScoredIntakeItem[];
  now?: Date;
  client?: SupabaseClient;
}): Promise<MarketMotionIngestionResult> {
  const db = input.client ?? createSupabaseAdminClient();
  const now = input.now ?? new Date();
  const warnings: string[] = [];
  const stories = await loadStories(db);

  let transcriptRows: ReviewedTranscriptMotionRow[] = [];
  try {
    transcriptRows = await loadRecentReviewedTranscripts({ db, now });
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Market Motion transcript-lead read failed.");
  }

  const reviewedVideoKeys = new Set(
    transcriptRows
      .filter((row) => parseTranscriptMotionLeads(row.transcript_motion_leads).length > 0)
      .map((row) => row.item_key),
  );
  const intakeCandidates = buildMarketMotionCandidates(
    input.items.filter((item) => item.itemType !== "video" || !reviewedVideoKeys.has(item.itemKey)),
    stories,
    { now, researchRunId: input.researchRunId },
  );
  const creatorCandidates = buildTranscriptMotionCandidates(
    transcriptRows,
    stories,
    { now, researchRunId: input.researchRunId },
  );
  const candidates = unifyMarketMotionCandidates(
    [...intakeCandidates, ...creatorCandidates],
    { researchRunId: input.researchRunId },
  );

  return persistUnifiedCandidates({
    candidates,
    db,
    considered: input.items.length + transcriptRows.length,
    creatorRowsConsidered: transcriptRows.length,
    creatorLeadCandidates: creatorCandidates.length,
    warnings,
  });
}

export async function persistMarketMotionFromMacroPulseCandidates(input: {
  submission: MacroPulseMotionSubmission;
  now?: Date;
  client?: SupabaseClient;
}): Promise<MarketMotionIngestionResult> {
  const db = input.client ?? createSupabaseAdminClient();
  const now = input.now ?? new Date();
  const warnings: string[] = [];
  const stories = await loadStories(db);
  const macroCandidates = buildMacroPulseMotionCandidates(input.submission, stories, { now });
  const candidates = unifyMarketMotionCandidates(macroCandidates);

  return persistUnifiedCandidates({
    candidates,
    db,
    considered: input.submission.candidates.length,
    creatorRowsConsidered: 0,
    creatorLeadCandidates: 0,
    warnings,
  });
}

export async function persistMarketMotionFromCreatorReviews(input: {
  intakeItemIds: string[];
  now?: Date;
  client?: SupabaseClient;
}): Promise<MarketMotionIngestionResult> {
  const db = input.client ?? createSupabaseAdminClient();
  const now = input.now ?? new Date();
  const warnings: string[] = [];
  if (!input.intakeItemIds.length) {
    return {
      considered: 0,
      eligible: 0,
      inserted: 0,
      skippedExisting: 0,
      creatorRowsConsidered: 0,
      creatorLeadCandidates: 0,
      motionIds: [],
      warnings,
    };
  }

  const stories = await loadStories(db);
  const transcriptRows = await loadRecentReviewedTranscripts({
    db,
    now,
    intakeItemIds: input.intakeItemIds,
  });
  const creatorCandidates = buildTranscriptMotionCandidates(transcriptRows, stories, { now });
  const candidates = unifyMarketMotionCandidates(creatorCandidates);

  return persistUnifiedCandidates({
    candidates,
    db,
    considered: transcriptRows.length,
    creatorRowsConsidered: transcriptRows.length,
    creatorLeadCandidates: creatorCandidates.length,
    warnings,
  });
}
