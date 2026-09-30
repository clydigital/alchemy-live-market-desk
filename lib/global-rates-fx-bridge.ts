import type { RoutedDossierInvestigation } from "./regime-investigations.ts";
import type { RegimeLiveStoryReasoning } from "./regime-live-reasoning.ts";
import type {
  ProjectedRegime,
  ProjectedRegimeSubgroup,
  RegimeContributionNode,
  RegimeTelemetryItem,
} from "./regimes.ts";

export type GlobalRatesFxBridgeState = "observed" | "supported" | "unresolved";

export type GlobalRatesFxBridgeStep = {
  key: "us-rates" | "ust-jgb-gap" | "usdjpy" | "japan-flows" | "risk-carry";
  label: string;
  title: string;
  state: GlobalRatesFxBridgeState;
  detail: string;
  evidenceLabel: string;
  nextTest: string | null;
  asOf: string | null;
};

export type GlobalRatesFxBridge = {
  steps: GlobalRatesFxBridgeStep[];
  observedCount: number;
  supportedCount: number;
  unresolvedCount: number;
};

type EvidenceLine = {
  text: string;
  at: string | null;
  kind: "telemetry" | "node" | "reasoning";
  state: "observed" | "supported" | "weak";
};

function validTimestamp(value: string | null | undefined) {
  return value && Number.isFinite(Date.parse(value)) ? value : null;
}

function latestTimestamp(lines: EvidenceLine[]) {
  return lines
    .map((line) => validTimestamp(line.at))
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] || null;
}

function telemetryLines(items: RegimeTelemetryItem[]): EvidenceLine[] {
  return items.map((item) => ({
    text: `${item.label}: ${item.state}. ${item.detail}`,
    at: item.asOf,
    kind: "telemetry" as const,
    state: "observed" as const,
  }));
}

function nodeLines(items: RegimeContributionNode[]): EvidenceLine[] {
  return items.map((item) => ({
    text: `${item.title}. ${item.detail}`,
    at: item.timestamp,
    kind: "node" as const,
    state: item.state === "supports" || item.state === "interpretation_pending"
      ? "observed" as const
      : item.state === "context"
        ? "weak" as const
        : "supported" as const,
  }));
}

function reasoningLines(
  items: RegimeLiveStoryReasoning[],
  storyIds: Set<string>,
): EvidenceLine[] {
  return items
    .filter((item) => storyIds.has(item.storyId))
    .flatMap((item) => item.causalChain.map((edge) => ({
      text: `${edge.from} ${edge.relationship} ${edge.to}. ${item.mechanism}`,
      at: item.updatedAt,
      kind: "reasoning" as const,
      state: edge.evidenceState === "observed" || edge.evidenceState === "strongly_supported"
        ? "supported" as const
        : "weak" as const,
    })));
}

function findMatching(lines: EvidenceLine[], predicate: (text: string) => boolean) {
  return lines.filter((line) => predicate(line.text));
}

function pickBest(lines: EvidenceLine[]) {
  const sorted = [...lines].sort((left, right) => {
    const weight = (line: EvidenceLine) => line.state === "observed" ? 3 : line.state === "supported" ? 2 : 1;
    const stateDelta = weight(right) - weight(left);
    if (stateDelta) return stateDelta;
    return Date.parse(right.at || "") - Date.parse(left.at || "");
  });
  return sorted[0] || null;
}

function evidenceState(lines: EvidenceLine[]): GlobalRatesFxBridgeState {
  if (lines.some((line) => line.state === "observed")) return "observed";
  if (lines.some((line) => line.state === "supported")) return "supported";
  return "unresolved";
}

function firstInvestigationGap(
  investigations: RoutedDossierInvestigation[],
  pattern: RegExp,
  fallback: string,
) {
  for (const item of investigations) {
    const candidates = [...item.missingEvidence, item.researchNext, item.confirmationCondition]
      .filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
    const match = candidates.find((value) => pattern.test(value));
    if (match) return match;
  }
  return fallback;
}

function regimeInvestigations(
  regime: ProjectedRegime,
  investigations: RoutedDossierInvestigation[],
) {
  return investigations.filter((item) =>
    item.regimeRoutes.some((route) => route.regime === regime.slug)
  );
}

function currentRiskRead(investigations: RoutedDossierInvestigation[]) {
  const pattern = /\b(credit|breadth|vix|move|volatility|risk|carry|small.?cap|transmission)\b/i;
  return investigations.find((item) =>
    pattern.test([
      item.question,
      item.currentExplanation,
      item.observedReaction,
      item.expectedReaction,
      item.whyItMatters,
    ].filter(Boolean).join(" "))
  ) || null;
}

function globalRatesSubgroup(regime: ProjectedRegime): ProjectedRegimeSubgroup | null {
  return regime.subgroups.find((item) => item.key === "global-rates") || null;
}

export function buildGlobalRatesFxBridge(input: {
  regime: ProjectedRegime;
  investigations: RoutedDossierInvestigation[];
  liveReasoning: RegimeLiveStoryReasoning[];
}): GlobalRatesFxBridge | null {
  const { regime, investigations, liveReasoning } = input;
  if (regime.slug !== "global-cost-of-capital") return null;

  const globalRates = globalRatesSubgroup(regime);
  if (!globalRates) return null;

  const rateTelemetry = regime.subgroups
    .filter((item) => item.key === "fed-front-end" || item.key === "long-end")
    .flatMap((item) => item.telemetry);
  const rateLines = telemetryLines(rateTelemetry);
  const globalStoryIds = new Set(globalRates.durableStories.map((story) => story.id));
  const globalLines = [
    ...telemetryLines(globalRates.telemetry),
    ...nodeLines(globalRates.nodes),
    ...reasoningLines(liveReasoning, globalStoryIds),
  ];
  const relevantInvestigations = regimeInvestigations(regime, investigations);

  const usRateEvidence = rateLines;
  const usRateBest = pickBest(usRateEvidence);

  const ustJgbEvidence = findMatching(globalLines, (text) =>
    /\b(jgb|japanese government bond)\b/i.test(text)
    && /\b(ust|u\.?s\.? treasur|treasur(?:y|ies)|us ?(?:2y|10y|20y|30y)|yield gap|rate differential|relative rate|spread)\b/i.test(text)
  );
  const jgbOnlyEvidence = findMatching(globalLines, (text) =>
    /\b(jgb|japanese government bond)\b/i.test(text)
  );
  const ustJgbBest = pickBest(ustJgbEvidence);

  const usdJpyEvidence = findMatching(globalLines, (text) =>
    /\b(usd\/?jpy|dollar[- ]?yen|yen (?:strength|weak|appreciat|depreciat|rall|sell|higher|lower))\b/i.test(text)
  );
  const usdJpyBest = pickBest(usdJpyEvidence);

  const flowEvidence = findMatching(globalLines, (text) =>
    /\b(tic|repatriat|capital flow|foreign (?:demand|holding|treasur)|treasury holdings|intervention|ministry of finance|\bmof\b|hedg(?:e|ing) cost|cross[- ]?currency basis|fx swap)\b/i.test(text)
  );
  const flowBest = pickBest(flowEvidence);

  const riskInvestigation = currentRiskRead(relevantInvestigations);
  const riskReasoning = findMatching(globalLines, (text) =>
    /\b(carry|risk transmission|credit|breadth|volatility|vix|move)\b/i.test(text)
  );
  const riskBest = pickBest(riskReasoning);
  const riskState: GlobalRatesFxBridgeState = riskInvestigation?.currentExplanation || riskInvestigation?.observedReaction
    ? "supported"
    : evidenceState(riskReasoning);

  const steps: GlobalRatesFxBridgeStep[] = [
    {
      key: "us-rates",
      label: "US RATES",
      title: usRateEvidence.length ? "US rates set the anchor" : "US rates anchor is unresolved",
      state: usRateEvidence.length ? "observed" : "unresolved",
      detail: usRateBest?.text || "No current canonical US front-end or long-end telemetry is available.",
      evidenceLabel: usRateEvidence.length
        ? `${usRateEvidence.length} canonical rate input${usRateEvidence.length === 1 ? "" : "s"}`
        : "No canonical rate telemetry",
      nextTest: usRateEvidence.length ? null : "Restore current 2Y, 10Y/30Y and real-yield telemetry.",
      asOf: latestTimestamp(usRateEvidence),
    },
    {
      key: "ust-jgb-gap",
      label: "UST ↔ JGB",
      title: ustJgbEvidence.length ? "Relative US–Japan rates are in evidence" : "UST–JGB rate gap still needs a direct read",
      state: evidenceState(ustJgbEvidence),
      detail: ustJgbBest?.text || (
        jgbOnlyEvidence.length
          ? "JGB evidence is present, but the desk does not yet have a comparable UST–JGB differential in the same evidence chain."
          : "The US side is observed, but no current canonical UST–JGB spread or comparable long-end move is persisted."
      ),
      evidenceLabel: ustJgbEvidence.length
        ? `${ustJgbEvidence.length} comparative evidence item${ustJgbEvidence.length === 1 ? "" : "s"}`
        : "Comparison unresolved",
      nextTest: firstInvestigationGap(
        relevantInvestigations,
        /\b(jgb|bund|global duration|long.?end|differential|spread)\b/i,
        "Compare UST and JGB 2Y/10Y/30Y moves over the same window.",
      ),
      asOf: latestTimestamp(ustJgbEvidence.length ? ustJgbEvidence : jgbOnlyEvidence),
    },
    {
      key: "usdjpy",
      label: "USDJPY",
      title: usdJpyEvidence.length ? "USDJPY is confirming the rates bridge" : "USDJPY confirmation is missing",
      state: evidenceState(usdJpyEvidence),
      detail: usdJpyBest?.text || "DXY is not a substitute here. The desk needs an explicit USDJPY/yen observation before it can call the FX leg confirmed.",
      evidenceLabel: usdJpyEvidence.length
        ? `${usdJpyEvidence.length} USDJPY/yen evidence item${usdJpyEvidence.length === 1 ? "" : "s"}`
        : "No explicit USDJPY observation",
      nextTest: firstInvestigationGap(
        relevantInvestigations,
        /\b(usd.?jpy|yen|fx|cross.?currency)\b/i,
        "Add USDJPY spot/change and compare it with the UST–JGB rate differential.",
      ),
      asOf: latestTimestamp(usdJpyEvidence),
    },
    {
      key: "japan-flows",
      label: "JAPAN FLOWS",
      title: flowEvidence.length ? "Japanese flow evidence is entering the chain" : "Japanese flow mechanism remains unverified",
      state: evidenceState(flowEvidence),
      detail: flowBest?.text || "Repatriation, Treasury holdings, intervention, hedging-cost and cross-currency-basis claims remain hypotheses until current evidence is persisted.",
      evidenceLabel: flowEvidence.length
        ? `${flowEvidence.length} flow/policy evidence item${flowEvidence.length === 1 ? "" : "s"}`
        : "Flow evidence unresolved",
      nextTest: firstInvestigationGap(
        relevantInvestigations,
        /\b(tic|flow|repatriat|intervention|basis|swap|dealer)\b/i,
        "Check TIC/foreign Treasury holdings, intervention evidence, hedging costs and cross-currency basis.",
      ),
      asOf: latestTimestamp(flowEvidence),
    },
    {
      key: "risk-carry",
      label: "RISK / CARRY",
      title: riskState === "supported" ? "Risk transmission has a provisional read" : "Carry/risk transmission is unresolved",
      state: riskState,
      detail: riskInvestigation?.currentExplanation
        || riskInvestigation?.observedReaction
        || riskBest?.text
        || "The desk cannot yet say whether the Japan/FX channel is reinforcing carry or turning into broader risk-off transmission.",
      evidenceLabel: riskInvestigation
        ? "Canonical Dossier investigation"
        : riskReasoning.length
          ? `${riskReasoning.length} supported causal edge${riskReasoning.length === 1 ? "" : "s"}`
          : "No confirmed carry transmission",
      nextTest: riskInvestigation?.confirmationCondition
        || riskInvestigation?.researchNext
        || "Compare credit, breadth and volatility with USDJPY and the relative-rate move.",
      asOf: riskBest?.at || null,
    },
  ];

  return {
    steps,
    observedCount: steps.filter((step) => step.state === "observed").length,
    supportedCount: steps.filter((step) => step.state === "supported").length,
    unresolvedCount: steps.filter((step) => step.state === "unresolved").length,
  };
}
