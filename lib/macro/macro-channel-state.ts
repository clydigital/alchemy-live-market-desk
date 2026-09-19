export const MACRO_CHANNEL_STATE_V1 = "macro-channel-state/v1" as const;

export const MACRO_CHANNEL_DEFINITIONS = {
  growth_demand: {
    label: "Growth / Demand",
    positiveMeaning: "Stronger broad or industrial demand",
    negativeMeaning: "Weaker broad or industrial demand",
  },
  policy_relief: {
    label: "Policy Relief",
    positiveMeaning: "More room for central-bank easing",
    negativeMeaning: "Less room for easing or more tightening pressure",
  },
  financial_conditions: {
    label: "Financial Conditions",
    positiveMeaning: "Easier financing conditions",
    negativeMeaning: "Tighter financing conditions",
  },
  broad_credit: {
    label: "Broad Credit",
    positiveMeaning: "Credit is broadly available on easier terms",
    negativeMeaning: "Credit availability is deteriorating",
  },
  tail_credit_stress: {
    label: "Weak-End Credit Stress",
    positiveMeaning: "More stress among weak borrowers",
    negativeMeaning: "Less stress among weak borrowers",
  },
  consumer: {
    label: "Consumer",
    positiveMeaning: "Stronger household demand",
    negativeMeaning: "Weaker household demand",
  },
  housing: {
    label: "Housing",
    positiveMeaning: "Stronger housing and construction activity",
    negativeMeaning: "Weaker housing and construction activity",
  },
  industrial_capex: {
    label: "Industrial / Power Capex",
    positiveMeaning: "Stronger physical investment and backlog demand",
    negativeMeaning: "Weaker physical investment and backlog demand",
  },
  input_cost_pressure: {
    label: "Input Costs",
    positiveMeaning: "More input-cost pressure",
    negativeMeaning: "Less input-cost pressure",
  },
  labour: {
    label: "Labour",
    positiveMeaning: "Stronger employment and wage-income backdrop",
    negativeMeaning: "Weaker employment and wage-income backdrop",
  },
  risk_appetite: {
    label: "Risk Appetite",
    positiveMeaning: "Stronger speculative or equity risk appetite",
    negativeMeaning: "Weaker speculative or equity risk appetite",
  },
  crude_tightness: {
    label: "Crude",
    positiveMeaning: "Tighter crude balance or stronger crude-price pressure",
    negativeMeaning: "Looser crude balance or weaker crude-price pressure",
  },
  product_tightness: {
    label: "Refined Products",
    positiveMeaning: "Tighter product balance or wider crack-spread pressure",
    negativeMeaning: "Looser product balance or weaker crack-spread pressure",
  },
  gas_tightness: {
    label: "Gas / LNG",
    positiveMeaning: "Tighter gas or LNG balance",
    negativeMeaning: "Looser gas or LNG balance",
  },
  global_rates: {
    label: "Global Rates",
    positiveMeaning: "Higher or more restrictive sovereign-rate pressure",
    negativeMeaning: "Lower or less restrictive sovereign-rate pressure",
  },
  japan_policy: {
    label: "Japan Policy / Yen Pressure",
    positiveMeaning: "More BoJ tightening or yen-support pressure",
    negativeMeaning: "Less BoJ tightening or yen-support pressure",
  },
} as const;

export type MacroChannelKey = keyof typeof MACRO_CHANNEL_DEFINITIONS;
export type MacroFreshness = "fresh" | "stale" | "unavailable";
export type MacroSnapshotHealth = "healthy" | "degraded" | "stale";

export type MacroSourceRef = {
  sourceName: string;
  sourceUrl: string | null;
  sourceTier: number | null;
  observedAt: string | null;
};

export type MacroChannelInput = {
  channelKey: MacroChannelKey;
  directionScore: number | null;
  confidence: number;
  regime: string;
  observedAt: string | null;
  staleAfterHours: number;
  interpretation: string;
  evidenceRefs: string[];
  sourceRefs: MacroSourceRef[];
  unavailableReason?: string | null;
};

export type MacroChannelStateV1 = {
  contractVersion: typeof MACRO_CHANNEL_STATE_V1;
  channelKey: MacroChannelKey;
  label: string;
  directionScore: number | null;
  activeDirectionScore: number;
  confidence: number;
  regime: string;
  observedAt: string | null;
  staleAfterHours: number;
  freshness: MacroFreshness;
  usableForReasoning: boolean;
  interpretation: string;
  positiveMeaning: string;
  negativeMeaning: string;
  evidenceRefs: string[];
  sourceRefs: MacroSourceRef[];
  unavailableReason: string | null;
};

export type MacroStateSnapshotV1 = {
  contractVersion: "macro-state-snapshot/v1";
  generatedAt: string;
  health: MacroSnapshotHealth;
  freshChannelCount: number;
  staleChannelCount: number;
  unavailableChannelCount: number;
  channels: MacroChannelStateV1[];
  diagnostics: string[];
};

const PLACEHOLDER_VALUES = new Set([
  "",
  "--",
  "—",
  "n/a",
  "na",
  "null",
  "undefined",
  "analyzing",
  "analysing",
  "loading",
  "pending",
]);

export function isUsableRawReading(value: unknown) {
  if (value == null) return false;
  if (typeof value === "number") return Number.isFinite(value);
  const normalised = String(value).trim().toLocaleLowerCase("en-US");
  return !PLACEHOLDER_VALUES.has(normalised);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function unique(values: string[]) {
  return [...new Set(values.filter((value) => Boolean(value?.trim())).map((value) => value.trim()))];
}

function validDate(value: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function macroChannelFreshness(input: Pick<MacroChannelInput, "directionScore" | "observedAt" | "staleAfterHours" | "unavailableReason">, now = new Date()) : MacroFreshness {
  if (input.directionScore == null || input.unavailableReason) return "unavailable";
  const observedAt = validDate(input.observedAt);
  if (observedAt == null) return "unavailable";
  const staleAfterMs = Math.max(1, input.staleAfterHours) * 60 * 60 * 1_000;
  return now.getTime() - observedAt > staleAfterMs ? "stale" : "fresh";
}

export function buildMacroChannelState(input: MacroChannelInput, now = new Date()): MacroChannelStateV1 {
  const definition = MACRO_CHANNEL_DEFINITIONS[input.channelKey];
  const freshness = macroChannelFreshness(input, now);
  const directionScore = input.directionScore == null ? null : clamp(input.directionScore, -2, 2);
  const confidence = clamp(input.confidence, 0, 1);
  const usableForReasoning = freshness === "fresh" && directionScore != null && input.evidenceRefs.length > 0;
  return {
    contractVersion: MACRO_CHANNEL_STATE_V1,
    channelKey: input.channelKey,
    label: definition.label,
    directionScore,
    activeDirectionScore: usableForReasoning ? directionScore : 0,
    confidence,
    regime: input.regime.trim(),
    observedAt: input.observedAt,
    staleAfterHours: Math.max(1, input.staleAfterHours),
    freshness,
    usableForReasoning,
    interpretation: input.interpretation.trim(),
    positiveMeaning: definition.positiveMeaning,
    negativeMeaning: definition.negativeMeaning,
    evidenceRefs: unique(input.evidenceRefs),
    sourceRefs: input.sourceRefs.map((source) => ({ ...source })),
    unavailableReason: input.unavailableReason?.trim() || null,
  };
}

export function composeMacroStateSnapshot(inputs: MacroChannelInput[], generatedAt = new Date().toISOString()): MacroStateSnapshotV1 {
  const now = new Date(generatedAt);
  const latestByKey = new Map<MacroChannelKey, MacroChannelInput>();
  for (const input of inputs) {
    const prior = latestByKey.get(input.channelKey);
    const inputTime = validDate(input.observedAt) ?? -Infinity;
    const priorTime = validDate(prior?.observedAt ?? null) ?? -Infinity;
    if (!prior || inputTime >= priorTime) latestByKey.set(input.channelKey, input);
  }

  const channels = (Object.keys(MACRO_CHANNEL_DEFINITIONS) as MacroChannelKey[]).map((channelKey) => {
    const input = latestByKey.get(channelKey);
    return buildMacroChannelState(input || {
      channelKey,
      directionScore: null,
      confidence: 0,
      regime: "Unavailable",
      observedAt: null,
      staleAfterHours: 24,
      interpretation: "No current canonical observation is available for this macro channel.",
      evidenceRefs: [],
      sourceRefs: [],
      unavailableReason: "No current channel input",
    }, now);
  });

  const freshChannelCount = channels.filter((channel) => channel.freshness === "fresh").length;
  const staleChannelCount = channels.filter((channel) => channel.freshness === "stale").length;
  const unavailableChannelCount = channels.filter((channel) => channel.freshness === "unavailable").length;

  // Missing channels are diagnostics, not an edition-wide permission gate.
  // A snapshot is stale only when it contains no fresh channels at all.
  const health: MacroSnapshotHealth = freshChannelCount === 0
    ? "stale"
    : staleChannelCount || unavailableChannelCount
      ? "degraded"
      : "healthy";

  const diagnostics = channels.flatMap((channel) => {
    if (channel.freshness === "fresh") return [];
    return [`${channel.label}: ${channel.freshness}${channel.unavailableReason ? ` (${channel.unavailableReason})` : ""}`];
  });

  return {
    contractVersion: "macro-state-snapshot/v1",
    generatedAt,
    health,
    freshChannelCount,
    staleChannelCount,
    unavailableChannelCount,
    channels,
    diagnostics,
  };
}

export function reasoningMacroChannels(snapshot: MacroStateSnapshotV1, relevantKeys?: MacroChannelKey[]) {
  const allowed = relevantKeys?.length ? new Set(relevantKeys) : null;
  return snapshot.channels.filter((channel) => channel.usableForReasoning && (!allowed || allowed.has(channel.channelKey)));
}
