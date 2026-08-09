import type { CaseMonitorBoard, CaseMonitorMetric, CaseMonitorSignal } from "@/lib/case-monitors";

const STATUS_URL = "https://straits.live/status";

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() && Number.isFinite(Number(value)) ? Number(value) : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function statusSnapshot(): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(STATUS_URL, {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(6500),
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function xPlaceholder(storySlug: string): CaseMonitorSignal {
  return {
    id: `x-watch-${storySlug}`,
    kind: "x",
    label: "X / Twitter monitor",
    headline: "No verified relevant X post in the current canonical window",
    detail: "Official-account posts can be attached through the statement/research intake. Until one is verified, X remains a watch channel rather than evidence.",
    asOf: null,
    sourceName: "Alchemy verified social watch",
    sourceUrl: null,
    verification: "no_verified_item",
  };
}

function metric(input: Partial<CaseMonitorMetric> & Pick<CaseMonitorMetric, "id" | "label" | "current" | "question" | "interpretation" | "confirmationCondition" | "invalidationCondition">): CaseMonitorMetric {
  return {
    kind: "physical",
    state: "unresolved",
    previous: null,
    delta: null,
    asOf: null,
    cadence: "Source-driven",
    sourceName: "Straits.live",
    sourceUrl: STATUS_URL,
    provenance: "External operational monitor",
    ...input,
  };
}

export async function enrichCaseMonitorBoard(board: CaseMonitorBoard | null): Promise<CaseMonitorBoard | null> {
  if (!board) return null;
  const signals = board.signals?.some((signal) => signal.kind === "x") ? board.signals : [...(board.signals || []), xPlaceholder(board.storySlug)];
  if (!["oil-physical-disruption", "refining-crack-spread-stress"].includes(board.storySlug)) return { ...board, signals };

  const root = await statusSnapshot();
  if (!root) return { ...board, signals };

  const transits = rec(root.transits);
  const daily = rec(root.dailyTransits);
  const insurance = rec(root.insurance);
  const aisGaps = rec(root.aisGaps);
  const verdict = rec(root.verdict);
  const carriers = Array.isArray(root.carrierSuspensions) ? root.carrierSuspensions.map(rec) : [];

  const count = num(transits.count) ?? num(daily.nTotal);
  const previous = num(daily.previousNTotal);
  const baseline = num(transits.baseline) ?? num(daily.preCrisisBaselineMedian) ?? 73;
  const throughput = num(transits.throughputPct) ?? num(root.throughputPercent);
  const insuranceMultiple = num(insurance.multiple) ?? num(root.insuranceMultiple);
  const aisVisible = num(root.aisConcurrentInZone);
  const dark = num(aisGaps.count);
  const asOf = text(root.asOf) || text(daily.updatedAt);
  const transitAsOf = text(transits.asOfDate) || text(daily.date) || asOf;
  const stopped = carriers.filter((item) => ["stopped", "rerouting", "suspended"].includes(String(item.hormuzPosture || item.status || "").toLowerCase())).length;
  const carrierTotal = carriers.length;
  const normalisationThreshold = 60;

  const physicalMetrics: CaseMonitorMetric[] = [
    metric({
      id: "hormuz-transits",
      label: "Hormuz commercial crossings",
      state: count == null ? "coverage_gap" : count >= normalisationThreshold ? "confirming" : count < 20 ? "contradicting" : "unresolved",
      current: count == null ? null : `${count} vessels/day`,
      previous: previous == null ? null : `${previous} vessels/day`,
      delta: count != null && previous != null ? `${count - previous >= 0 ? "+" : ""}${count - previous}` : null,
      asOf: transitAsOf,
      cadence: "IMF PortWatch daily series; upstream publishes weekly",
      sourceName: "Straits.live / IMF PortWatch",
      question: "Has commercial traffic actually resumed towards normal?",
      interpretation: count == null ? "No readable crossing count was returned." : `${count} crossings versus roughly ${baseline}/day before the crisis.${throughput != null ? ` That is about ${throughput}% of the pre-crisis level.` : ""}`,
      confirmationCondition: `Repeated crossings with a 7-day average at or above ${normalisationThreshold}/day.`,
      invalidationCondition: "Crossings remain far below normal or fall again after diplomatic headlines.",
      provenance: "IMF PortWatch crossing count surfaced by Straits.live",
    }),
    metric({
      id: "hormuz-throughput",
      label: "Hormuz throughput vs normal",
      state: throughput == null ? "coverage_gap" : throughput >= 82 ? "confirming" : throughput < 30 ? "contradicting" : "unresolved",
      current: throughput == null ? null : `${throughput}% of normal`,
      asOf: transitAsOf,
      cadence: "With PortWatch transit update",
      sourceName: "Straits.live / IMF PortWatch",
      question: "Is traffic volume close enough to normal to call reopening commercial rather than symbolic?",
      interpretation: throughput == null ? "No throughput percentage was returned." : `Current completed crossings are running at about ${throughput}% of the stable pre-crisis benchmark.`,
      confirmationCondition: "Throughput recovers close to the stable pre-crisis range and remains there across repeated observations.",
      invalidationCondition: "Throughput remains deeply depressed despite a political agreement.",
      provenance: "Derived from PortWatch count versus fixed pre-crisis baseline",
    }),
    metric({
      id: "hormuz-insurance",
      label: "War-risk insurance premium",
      state: insuranceMultiple == null ? "coverage_gap" : insuranceMultiple <= 3 ? "confirming" : insuranceMultiple >= 10 ? "contradicting" : "unresolved",
      current: insuranceMultiple == null ? null : `${insuranceMultiple}× peace baseline`,
      asOf: text(insurance.updatedAt) || asOf,
      cadence: "Curated / weekly review",
      sourceName: text(insurance.sourceName) || "Straits.live insurance monitor",
      sourceUrl: text(insurance.sourceUrl) || STATUS_URL,
      question: "Are commercial risk costs falling enough for normal carrier behaviour to return?",
      interpretation: insuranceMultiple == null ? "No readable insurance multiple was returned." : `War-risk insurance is estimated at roughly ${insuranceMultiple} times its peace baseline.`,
      confirmationCondition: "Insurance compresses materially toward normal alongside sustained transit recovery.",
      invalidationCondition: "Insurance remains extreme or rises again.",
      provenance: "Straits.live derived insurance indicator from carrier advisories and trade reporting",
    }),
    metric({
      id: "hormuz-carriers",
      label: "Major carrier posture",
      state: carrierTotal === 0 ? "coverage_gap" : stopped >= 5 ? "contradicting" : stopped <= 1 ? "confirming" : "unresolved",
      current: carrierTotal ? `${stopped}/${carrierTotal} stopped or rerouting` : null,
      asOf: asOf,
      cadence: "Curated / weekly review",
      sourceName: "Straits.live carrier advisories",
      question: "Are major commercial carriers actually treating the Strait as usable?",
      interpretation: carrierTotal ? `${stopped} of ${carrierTotal} tracked major carriers are stopped, suspended or rerouting rather than treating Hormuz as normal.` : "Carrier posture was not returned.",
      confirmationCondition: "Most tracked major carriers return to normal transit posture.",
      invalidationCondition: "Five or more major carriers remain stopped or rerouting.",
      provenance: "Carrier advisories aggregated by Straits.live",
    }),
    metric({
      id: "hormuz-ais",
      label: "AIS presence / dark-vessel context",
      state: aisVisible == null && dark == null ? "coverage_gap" : "unresolved",
      current: aisVisible == null && dark == null ? null : `${aisVisible ?? "n/a"} AIS-visible · ${dark ?? "n/a"} dark/gap`,
      asOf: text(aisGaps.updatedAt) || asOf,
      cadence: "Approx. 30-minute AIS window",
      sourceName: "Straits.live AIS monitor",
      question: "Does visible vessel activity agree with the authoritative crossing count, and how much AIS darkness remains?",
      interpretation: "AIS is supporting context only. The wider Gulf watch-box presence is not the same population as completed Hormuz crossings.",
      confirmationCondition: "AIS context broadens consistently with recovered completed crossings while gap counts normalise.",
      invalidationCondition: "Visible AIS activity diverges from completed crossings or dark-vessel activity remains unusually elevated.",
      provenance: "AIS-derived context; explicitly not substituted for IMF PortWatch crossings",
    }),
  ];

  const nonHormuz = (board.metrics || []).filter((item) => !item.id.startsWith("hormuz-"));
  const isNormal = count != null && count >= normalisationThreshold && insuranceMultiple != null && insuranceMultiple <= 3 && stopped <= 1;
  const clearlyNotNormal = (count != null && count < 20) || (throughput != null && throughput < 30) || (insuranceMultiple != null && insuranceMultiple >= 10) || stopped >= 5;
  const state = isNormal ? "confirming" : clearlyNotNormal ? "contradicting" : "unresolved";
  const baseLabel = isNormal ? "PHYSICAL REOPENING CONFIRMED" : clearlyNotNormal ? "NORMALITY NOT CONFIRMED" : "REOPENING PARTIAL · NOT YET NORMAL";
  const statusWord = text(root.status) || text(verdict.status);
  const summary = isNormal
    ? "Commercial crossings, insurance and carrier behaviour are aligning with a durable reopening. Incident frequency still needs to remain contained."
    : `Diplomatic progress has not yet translated into normal commercial conditions.${count != null ? ` PortWatch shows ${count} crossings versus ~${baseline}/day pre-crisis.` : ""}${insuranceMultiple != null ? ` War-risk insurance remains near ${insuranceMultiple}× normal.` : ""}${statusWord ? ` Operational status is ${statusWord}.` : ""}`;

  return {
    ...board,
    state: board.storySlug === "refining-crack-spread-stress" && isNormal ? "unresolved" : state,
    stateLabel: board.storySlug === "refining-crack-spread-stress" && isNormal ? "HORMUZ IMPROVING · PRODUCT TEST STILL OPEN" : baseLabel,
    summary: board.storySlug === "refining-crack-spread-stress" ? `${summary} The product-inflation case still needs diesel/gasoline cracks, refinery runs and product inventories to settle.` : summary,
    updatedAt: asOf || board.updatedAt,
    metrics: [...physicalMetrics, ...nonHormuz],
    signals,
    gaps: Array.from(new Set((board.gaps || []).filter((label) => !["Strait of Hormuz · daily transits", "Strait of Hormuz · 7D transit average", "Hormuz war-risk insurance", "Hormuz AIS presence / dark vessels"].includes(label)))),
  };
}

export async function enrichCaseMonitorBoards(boards: CaseMonitorBoard[]): Promise<CaseMonitorBoard[]> {
  return Promise.all(boards.map((board) => enrichCaseMonitorBoard(board) as Promise<CaseMonitorBoard>));
}
