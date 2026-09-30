import type { Story } from "./data.ts";
import type { StoryThesisVersion } from "./persistence/contracts.ts";
import {
  materialiseCanonicalStoryReasoningV1,
  type EvidenceState,
} from "./intelligence/story-reasoning.ts";
import {
  assessStoryCatalyst,
  storyFramingDependsOnExpiredCatalyst,
} from "./story-hygiene.ts";
import { readerFacingText } from "./presentation-hygiene.ts";

export const STORY_BREAKDOWN_V1 = "story-breakdown/1" as const;

export type StoryPresentationState = "active" | "context" | "needs_reframe" | "archived";

export type StoryBreakdownMechanism = {
  from: string;
  relationship: string;
  to: string;
  evidenceState: EvidenceState;
};

export type StoryBreakdownImplication = {
  asset: string;
  bias: string;
  baseCase: string;
  confirmation: string;
  invalidation: string;
};

export type StoryBreakdown = {
  contractVersion: typeof STORY_BREAKDOWN_V1;
  storyId: string;
  thesisVersionId: string | null;
  presentationState: StoryPresentationState;
  freshnessReason: string;
  whatHappened: string;
  affectedMarkets: string[];
  whyItMatters: string;
  currentRead: string;
  mechanism: StoryBreakdownMechanism[];
  implications: StoryBreakdownImplication[];
  confirmation: string[];
  invalidation: string[];
  nextTest: { label: string; status: string } | null;
  hybridHref: string;
};

type BreakdownEvent = { headline: string; detail?: string | null; at?: string | null };

function unique(values: Array<string | null | undefined>, limit = Number.POSITIVE_INFINITY) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))]
    .slice(0, limit);
}
function lifecycle(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}
function currentTitle(story: Story, version?: StoryThesisVersion | null) {
  return version?.title || story.title;
}
function currentThesis(story: Story, version?: StoryThesisVersion | null) {
  return version?.thesis || story.thesis;
}

const MARKET_SYMBOL_PATTERN = /\b(?:US02Y|US05Y|US10Y|US20Y|US30Y|SPX|SPY|QQQ|NDX|NASDAQ|RSP|DXY|UUP|TLT|IEF|SHY|XAUUSD|GOLD|WTI|BRENT|USO|ULSD|USDJPY|EURUSD|GBPUSD|AUDUSD|USDCAD|USDCHF|NIKKEI|KOSPI|HSI|SMH|SOXX|META|NVDA|AMD|MSFT|GOOGL|AMZN|TSLA)\b/gi;

function explicitMarketSymbols(values: Array<string | null | undefined>) {
  return values.flatMap((value) => value?.match(MARKET_SYMBOL_PATTERN) || []).map((value) => value.toUpperCase());
}

export function storyPresentationState(input: { story: Story; version?: StoryThesisVersion | null; now?: Date }) {
  const { story, version } = input;
  const currentStatus = lifecycle(version?.status || story.article_verdict || story.status);
  const confidence = version?.confidence ?? story.confidence;

  if (/invalid|archive/.test(currentStatus)) {
    return { state: "archived" as const, reason: `Lifecycle is ${currentStatus || "inactive"}; the Story remains historical rather than current.` };
  }

  if (version && storyFramingDependsOnExpiredCatalyst({
    title: currentTitle(story, version),
    thesis: currentThesis(story, version),
    version,
  })) {
    const catalyst = assessStoryCatalyst({
      nextCatalyst: version.next_catalyst || story.next_catalyst,
      version,
      now: input.now,
    });
    return {
      state: "needs_reframe" as const,
      reason: `Expired deciding catalyst still anchors the current framing${catalyst.label ? `: ${catalyst.label}` : ""}.`,
    };
  }

  if (/weaken|dormant/.test(currentStatus) || confidence < 25) {
    return {
      state: "context" as const,
      reason: /weaken|dormant/.test(currentStatus)
        ? "The Story is weakening or dormant and should be read as context until it strengthens or is reframed."
        : `Confidence is ${confidence}%, below the active contribution threshold.`,
    };
  }

  const catalyst = assessStoryCatalyst({
    nextCatalyst: version?.next_catalyst || story.next_catalyst,
    version,
    now: input.now,
  });
  return {
    state: "active" as const,
    reason: catalyst.status === "expired"
      ? "A prior catalyst expired, but the current framing no longer depends on that event."
      : "Current framing passes deterministic freshness checks.",
  };
}

export function buildStoryBreakdown(input: {
  story: Story;
  version?: StoryThesisVersion | null;
  event?: BreakdownEvent | null;
  now?: Date;
}): StoryBreakdown {
  const { story, version, event } = input;
  const reasoning = version ? materialiseCanonicalStoryReasoningV1(version) : null;
  const presentation = storyPresentationState({ story, version, now: input.now });
  const catalyst = assessStoryCatalyst({
    nextCatalyst: version?.next_catalyst || story.next_catalyst,
    version,
    now: input.now,
  });
  const title = currentTitle(story, version);
  const thesis = currentThesis(story, version);
  const bestExplanation = version?.best_explanation || story.best_explanation;

  const mechanism = (reasoning?.causalChain || []).slice(0, 5).map((edge) => ({
    from: edge.from,
    relationship: edge.relationship,
    to: edge.to,
    evidenceState: edge.evidenceState,
  }));
  const implications = (reasoning?.assetImplications || []).slice(0, 5).map((impact) => ({
    asset: impact.asset,
    bias: impact.bias,
    baseCase: impact.baseCase,
    confirmation: impact.confirmation,
    invalidation: impact.invalidation,
  }));
  const explicitMarkets = reasoning ? explicitMarketSymbols([
    reasoning.currentState,
    reasoning.marketReaction,
    reasoning.acceptedExplanation,
    reasoning.nextTest?.label,
    ...(reasoning.confirmation || []),
    ...(reasoning.invalidation || []),
    ...(reasoning.causalChain || []).flatMap((edge) => [edge.from, edge.relationship, edge.to]),
    ...(reasoning.assetImplications || []).flatMap((impact) => [impact.baseCase, impact.confirmation, impact.invalidation]),
  ]) : [];
  const affectedMarkets = unique([
    ...implications.map((item) => item.asset),
    ...explicitMarkets,
    ...(version?.assets || []),
    ...(story.assets || []),
  ], 10);
  const confirmation = unique([
    ...(reasoning?.confirmation || []),
    version?.confirmation_trigger,
    story.confirmation_trigger,
  ], 4);
  const invalidation = unique([
    ...(reasoning?.invalidation || []),
    version?.invalidation_trigger,
    story.invalidation_trigger,
  ], 4);
  const eventChange = readerFacingText(event?.headline);
  const reasoningChange = readerFacingText(reasoning?.whatChanged);
  const versionChange = readerFacingText(version?.change_reason);
  const maintenanceRecalibration = Boolean(
    event?.headline && !eventChange
    || reasoning?.whatChanged && !reasoningChange
    || version?.change_reason && !versionChange
  );
  const currentNextTest = catalyst.label && !["expired", "resolved"].includes(catalyst.status)
    ? { label: catalyst.label, status: catalyst.status }
    : null;

  return {
    contractVersion: STORY_BREAKDOWN_V1,
    storyId: story.id,
    thesisVersionId: version?.id || null,
    presentationState: presentation.state,
    freshnessReason: presentation.reason,
    whatHappened: eventChange
      || reasoningChange
      || versionChange
      || (maintenanceRecalibration ? "Story thesis recalibrated from new evidence." : `Current Story state: ${title}`),
    affectedMarkets,
    whyItMatters: reasoning?.acceptedExplanation?.trim() || bestExplanation?.trim() || thesis,
    currentRead: reasoning?.currentState?.trim() || thesis,
    mechanism,
    implications,
    confirmation,
    invalidation,
    nextTest: currentNextTest,
    hybridHref: `/hybrid-output?story=${encodeURIComponent(story.slug)}`,
  };
}
